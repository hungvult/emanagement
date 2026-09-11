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

import httpx
import numpy as np
from fastapi import APIRouter, Depends, Request

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
from app.services.liveness_service import liveness_detector
from app.utils.image_utils import InvalidImageError, base64_to_cv2
from app.utils.similarity import cosine_similarity

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
def enroll_face(request: EnrollRequest, req: Request) -> ApiResponse[EnrollResponse]:
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
            return respond_fail(
                detect_status,
                f"Không phát hiện khuôn mặt rõ ràng ở bước {idx + 1}! Vui lòng quét lại từ đầu.",
                results,
            )

        face = faces[0]
        quality_status, quality_score, _ = face_quality_assessor.evaluate_quality(img, face.bbox)
        if quality_status != CvStatus.VALID:
            results.append(_frame_result(idx, quality_status, quality_score))
            return respond_fail(
                quality_status,
                f"Chất lượng ảnh ở bước {idx + 1} không đạt yêu cầu. Vui lòng quét lại.",
                results,
            )

        # Chống giả mạo ảnh (Anti-Spoofing): phát hiện ảnh in hoặc màn hình thiết bị
        spoof_status, is_real, liveness_score, _ = liveness_detector.check_liveness(img, face.bbox)
        if idx == 0:
            # Bước 1 (nhìn thẳng chính diện): Bắt buộc phải vượt qua kiểm tra liveness chuẩn
            if spoof_status == CvStatus.SPOOF_DETECTED:
                results.append(_frame_result(idx, spoof_status, quality_score))
                logger.warning(f"Phát hiện hành vi giả mạo khuôn mặt ở bước 1 (nhìn thẳng)! score={liveness_score}")
                return respond_fail(
                    CvStatus.SPOOF_DETECTED,
                    "Phát hiện hành vi giả mạo (ảnh chụp màn hình điện thoại/ảnh in) ở bước 1! Đăng ký bị từ chối.",
                    results,
                )
        else:
            # Bước 2..5 (chớp mắt, quay trái, quay phải, ngẩng mặt): Là các bước tương tác chủ động (Active Liveness).
            # Do người dùng quay đầu / nhắm mắt, góc mặt thay đổi. Tính sống đã được đảm bảo bởi chuỗi
            # hành vi chuyển động 3D và bước kiểm tra độ tương đồng chéo (Self-Consistency) với bước 1.
            # Chỉ từ chối nếu điểm liveness bất thường cực kỳ thấp (< 0.20 - hoàn toàn mất đặc trưng người thật).
            if liveness_score < 0.20:
                results.append(_frame_result(idx, CvStatus.SPOOF_DETECTED, quality_score))
                logger.warning(f"Phát hiện hành vi giả mạo khuôn mặt ở bước #{idx + 1}! score={liveness_score}")
                return respond_fail(
                    CvStatus.SPOOF_DETECTED,
                    f"Phát hiện hành vi giả mạo (ảnh chụp màn hình điện thoại/ảnh in) ở bước {idx + 1}! Đăng ký bị từ chối.",
                    results,
                )
        if spoof_status not in (CvStatus.VALID, CvStatus.SPOOF_DETECTED):
            results.append(_frame_result(idx, spoof_status, quality_score))
            return respond_fail(
                spoof_status,
                f"Lỗi kiểm tra tính sống ở bước {idx + 1}: {results[-1].message}",
                results,
            )

        try:
            vector = embedding_service.extract_embedding(img, face)
        except ModelNotReadyError:
            return respond_fail(
                CvStatus.MODEL_NOT_READY, STATUS_MESSAGES[CvStatus.MODEL_NOT_READY], results
            )
        except Exception:  # noqa: BLE001
            logger.exception(f"Lỗi trích xuất embedding ảnh #{idx}")
            results.append(_frame_result(idx, CvStatus.INTERNAL_ERROR, quality_score))
            return respond_fail(
                CvStatus.INTERNAL_ERROR,
                f"Lỗi trích xuất đặc trưng khuôn mặt ở bước {idx + 1}. Vui lòng thử lại.",
                results,
            )

        valid_vectors.append(vector)
        quality_scores.append(quality_score)
        results.append(_frame_result(idx, CvStatus.VALID, quality_score))

    if len(valid_vectors) < 5:
        return respond_fail(
            CvStatus.LOW_FACE_QUALITY,
            f"Cần hoàn tất đủ 5 bước hợp lệ (nhận được {len(valid_vectors)}/5 ảnh đạt chuẩn). Vui lòng thử lại.",
            results,
        )

    # Kiểm tra tính đồng nhất khuôn mặt giữa các frame (Cross-Frame Self-Consistency Check)
    # Tất cả các ảnh trong cùng một phiên eKYC phải thuộc về CÙNG MỘT NGƯỜI.
    # Ngăn chặn 100% việc dùng ảnh người A ở bước 1, rồi dùng người B ở các bước sau.
    if len(valid_vectors) >= 2:
        # 1. Kiểm tra 2 ảnh chính diện (Frame 0 và Frame 1): cùng 1 người chụp trong 1 phiên bắt buộc sim >= 0.60
        sim_front = cosine_similarity(valid_vectors[0], valid_vectors[1])
        logger.info(f"[eKYC Self-Consistency] Độ tương đồng 2 ảnh chính diện (Frame #0 vs Frame #1): {sim_front:.4f}")
        if sim_front < 0.60:
            logger.warning(
                f"Phát hiện đổi người giữa bước 1 và bước 2! Frame #0 vs Frame #1 chỉ đạt {sim_front:.4f} < 0.60"
            )
            return respond_fail(
                CvStatus.MULTIPLE_FACES,
                "Phát hiện khuôn mặt ở các bước không thuộc cùng một người! Vui lòng không đổi người hoặc đổi ảnh giữa chừng.",
                results,
            )

        # 2. Kiểm tra tất cả các góc mặt (Frame 2 - trái, Frame 3 - phải, Frame 4 - ngẩng) so với ảnh chính diện
        for idx_angle in range(2, len(valid_vectors)):
            sim_f0 = cosine_similarity(valid_vectors[0], valid_vectors[idx_angle])
            sim_f1 = cosine_similarity(valid_vectors[1], valid_vectors[idx_angle])
            logger.info(
                f"[eKYC Self-Consistency] Góc #{idx_angle} vs Frame #0: {sim_f0:.4f}, vs Frame #1: {sim_f1:.4f}"
            )
            if sim_f0 < 0.42 or sim_f1 < 0.42:
                logger.warning(
                    f"Phát hiện góc #{idx_angle} không thuộc cùng người với ảnh chính diện "
                    f"(sim_f0={sim_f0:.4f}, sim_f1={sim_f1:.4f} < 0.42)"
                )
                return respond_fail(
                    CvStatus.MULTIPLE_FACES,
                    "Phát hiện khuôn mặt ở các bước không thuộc cùng một người! Vui lòng không đổi người hoặc đổi ảnh giữa chừng.",
                    results,
                )

        # 3. Kiểm tra pairwise giữa tất cả các cặp
        for i in range(len(valid_vectors)):
            for j in range(i + 1, len(valid_vectors)):
                sim = cosine_similarity(valid_vectors[i], valid_vectors[j])
                logger.info(f"[eKYC Pairwise] Frame #{i} vs Frame #{j} similarity = {sim:.4f}")
                if sim < 0.40:
                    logger.warning(
                        f"Phát hiện độ tương đồng thấp giữa Frame #{i} và Frame #{j}: {sim:.4f} < 0.40"
                    )
                    return respond_fail(
                        CvStatus.MULTIPLE_FACES,
                        "Phát hiện khuôn mặt ở các bước không thuộc cùng một người! Vui lòng không đổi người hoặc đổi ảnh giữa chừng.",
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

    try:
        auth_header = req.headers.get("Authorization")
        headers = {}
        if auth_header:
            headers["Authorization"] = auth_header

        spring_payload = {
            "userId": request.userId,
            "faceVector": final_embedding
        }
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                f"{settings.SPRING_BOOT_URL}/api/v1/employees/ekyc-enroll",
                json=spring_payload,
                headers=headers
            )
            resp.raise_for_status()
    except Exception as e:
        logger.error(f"Lỗi khi gửi vector sang Spring Boot: {e}")
        return respond_fail(
            CvStatus.INTERNAL_ERROR, 
            f"Lỗi lưu trữ vector tại Backend Java: {str(e)}", 
            results
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
