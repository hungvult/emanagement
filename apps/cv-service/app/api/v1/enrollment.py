import time
from typing import List
import numpy as np
from fastapi import APIRouter

from app.core.constants import CvStatus
from app.core.logging import log_inference_metrics
from app.schemas.common import ApiResponse
from app.schemas.enrollment import EnrollRequest, EnrollResponse
from app.services.embedding_service import embedding_service
from app.services.face_detector import face_detector
from app.services.face_quality import face_quality_assessor
from app.utils.image_utils import base64_to_cv2

router = APIRouter(prefix="/cv", tags=["Enrollment"])


@router.post("/enroll", response_model=ApiResponse[EnrollResponse])
def enroll_face(request: EnrollRequest) -> ApiResponse[EnrollResponse]:
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"

    if not request.images:
        return ApiResponse.fail(
            status=CvStatus.LOW_FACE_QUALITY,
            message="Danh sách ảnh đăng ký không được để trống"
        )

    valid_vectors: List[List[float]] = []
    quality_scores: List[float] = []

    for idx, img_b64 in enumerate(request.images):
        try:
            img = base64_to_cv2(img_b64)
        except Exception:
            continue

        status, faces = face_detector.detect_faces(img)
        if status != CvStatus.VALID or len(faces) == 0:
            continue

        primary_bbox = faces[0]
        q_status, q_score, _ = face_quality_assessor.evaluate_quality(img, primary_bbox)
        if q_status != CvStatus.VALID:
            continue

        vec = embedding_service.extract_embedding(img, primary_bbox)
        valid_vectors.append(vec)
        quality_scores.append(q_score)

    if not valid_vectors:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/enroll", CvStatus.LOW_FACE_QUALITY.value, proc_time)
        return ApiResponse.fail(
            status=CvStatus.LOW_FACE_QUALITY,
            message="Không có ảnh nào trong danh sách đạt đủ tiêu chuẩn chất lượng để đăng ký"
        )

    # Tổng hợp các vector đặc trưng bằng cách lấy trung bình (Mean Vector)
    avg_vec = np.mean(valid_vectors, axis=0)
    norm = np.linalg.norm(avg_vec)
    if norm > 0.0:
        final_embedding = (avg_vec / norm).tolist()
    else:
        final_embedding = avg_vec.tolist()

    final_embedding = [float(np.round(v, 6)) for v in final_embedding]
    avg_quality = float(np.round(np.mean(quality_scores), 2))

    proc_time = (time.time() - start_time) * 1000
    log_inference_metrics(request_id, "/enroll", CvStatus.VALID.value, proc_time, face_count=len(valid_vectors))

    return ApiResponse.ok(
        status=CvStatus.VALID,
        message=f"Đăng ký khuôn mặt cho nhân viên #{request.userId} thành công",
        data=EnrollResponse(
            userId=request.userId,
            embedding=final_embedding,
            qualityScore=avg_quality,
            processedFrames=len(valid_vectors)
        )
    )
