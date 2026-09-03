"""Endpoint đăng ký khuôn mặt: nhiều ảnh -> một vector đại diện.

Nguyên tắc: chỉ ảnh thật sự phát hiện được đúng một khuôn mặt và đạt ngưỡng chất
lượng mới được đưa vào vector đại diện. Bản trước bịa bounding box giữa khung hình
khi không thấy mặt và nâng điểm chất lượng lên sàn 0.6, nên có thể đăng ký thành
công bằng ảnh không có người - dẫn tới vector rác nằm trong cơ sở dữ liệu.

Không kiểm tra tư thế chính diện ở đây: luồng eKYC cố tình yêu cầu nhân viên quay
trái/phải/ngẩng lên để vector đại diện phủ nhiều góc mặt.
"""

import time
from typing import List

import numpy as np
from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.constants import STATUS_MESSAGES, CvStatus
from app.core.logging import log_inference_metrics, logger
from app.core.security import require_api_key
from app.schemas.common import ApiResponse
from app.schemas.enrollment import EnrollRequest, EnrollResponse, FrameResultDto
from app.services.embedding_service import (
    ModelNotReadyError,
    average_embeddings,
    embedding_service,
)
from app.services.face_detector import face_detector
from app.services.face_quality import face_quality_assessor
from app.utils.image_utils import InvalidImageError, base64_to_cv2

router = APIRouter(prefix="/cv", tags=["Enrollment"], dependencies=[Depends(require_api_key)])


def _frame_result(index: int, status: CvStatus, quality: float = 0.0) -> FrameResultDto:
    return FrameResultDto(
        index=index,
        accepted=status == CvStatus.VALID,
        status=status.value,
        message=STATUS_MESSAGES.get(status, ""),
        qualityScore=round(quality, 2),
    )


@router.post("/enroll", response_model=ApiResponse[EnrollResponse])
def enroll_face(request: EnrollRequest) -> ApiResponse[EnrollResponse]:
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"
    total = len(request.images)

    def respond_fail(status: CvStatus, message: str, results: List[FrameResultDto]):
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/enroll", status.value, proc_time)
        return ApiResponse.fail(
            status=status,
            message=message,
            data=EnrollResponse(
                userId=request.userId,
                processedFrames=0,
                totalFrames=total,
                frameResults=results,
            ),
        )

    if total < settings.MIN_ENROLL_IMAGES:
        return respond_fail(
            CvStatus.LOW_FACE_QUALITY,
            f"Cần tối thiểu {settings.MIN_ENROLL_IMAGES} ảnh để đăng ký khuôn mặt "
            f"(nhận được {total}).",
            [],
        )

    if total > settings.MAX_ENROLL_IMAGES:
        return respond_fail(
            CvStatus.LOW_FACE_QUALITY,
            f"Chỉ chấp nhận tối đa {settings.MAX_ENROLL_IMAGES} ảnh mỗi lần đăng ký "
            f"(nhận được {total}).",
            [],
        )

    if not embedding_service.is_ready:
        return respond_fail(
            CvStatus.MODEL_NOT_READY, STATUS_MESSAGES[CvStatus.MODEL_NOT_READY], []
        )

    results: List[FrameResultDto] = []
    valid_vectors: List[List[float]] = []
    quality_scores: List[float] = []

    for idx, img_b64 in enumerate(request.images):
        try:
            img = base64_to_cv2(img_b64)
        except InvalidImageError:
            results.append(_frame_result(idx, CvStatus.INVALID_IMAGE))
            continue

        detect_status, faces = face_detector.detect_faces(img)
        if detect_status != CvStatus.VALID:
            results.append(_frame_result(idx, detect_status))
            continue

        face = faces[0]
        quality_status, quality_score, _ = face_quality_assessor.evaluate_quality(img, face.bbox)
        if quality_status != CvStatus.VALID:
            results.append(_frame_result(idx, quality_status, quality_score))
            continue

        try:
            vector = embedding_service.extract_embedding(img, face)
        except ModelNotReadyError:
            return respond_fail(
                CvStatus.MODEL_NOT_READY, STATUS_MESSAGES[CvStatus.MODEL_NOT_READY], results
            )
        except Exception:  # noqa: BLE001 - ảnh lỗi riêng lẻ không được làm sập cả lượt đăng ký
            logger.exception(f"Lỗi trích xuất embedding ảnh #{idx}")
            results.append(_frame_result(idx, CvStatus.INTERNAL_ERROR, quality_score))
            continue

        valid_vectors.append(vector)
        quality_scores.append(quality_score)
        results.append(_frame_result(idx, CvStatus.VALID, quality_score))

    if len(valid_vectors) < settings.MIN_ENROLL_IMAGES:
        return respond_fail(
            CvStatus.LOW_FACE_QUALITY,
            f"Chỉ có {len(valid_vectors)}/{total} ảnh đạt yêu cầu, cần tối thiểu "
            f"{settings.MIN_ENROLL_IMAGES} ảnh hợp lệ. Vui lòng chụp lại trong điều kiện "
            f"đủ sáng, nhìn rõ khuôn mặt và chỉ có một người trong khung hình.",
            results,
        )

    final_embedding = average_embeddings(valid_vectors)
    avg_quality = float(np.round(float(np.mean(quality_scores)), 2))

    proc_time = (time.time() - start_time) * 1000
    log_inference_metrics(
        request_id,
        "/enroll",
        CvStatus.ENROLLMENT_SUCCESS.value,
        proc_time,
        face_count=len(valid_vectors),
    )

    return ApiResponse.ok(
        status=CvStatus.ENROLLMENT_SUCCESS,
        message=f"Đăng ký khuôn mặt cho nhân viên #{request.userId} thành công "
        f"({len(valid_vectors)}/{total} ảnh hợp lệ).",
        data=EnrollResponse(
            userId=request.userId,
            embedding=final_embedding,
            qualityScore=avg_quality,
            processedFrames=len(valid_vectors),
            totalFrames=total,
            embeddingDimension=len(final_embedding),
            frameResults=results,
        ),
    )
