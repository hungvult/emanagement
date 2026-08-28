import time
from typing import Dict, Any
from fastapi import APIRouter

from app.core.constants import CvStatus
from app.core.logging import log_inference_metrics
from app.schemas.common import ApiResponse
from app.schemas.recognition import RecognizeRequest, RecognizeResponse
from app.services.face_detector import face_detector
from app.services.face_quality import face_quality_assessor
from app.services.recognition_service import recognition_service
from app.utils.image_utils import base64_to_cv2

router = APIRouter(prefix="/cv", tags=["Recognition"])


@router.post("/recognize", response_model=ApiResponse[RecognizeResponse])
def recognize_face(request: RecognizeRequest) -> ApiResponse[RecognizeResponse]:
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"

    try:
        # 1. Giải mã Base64 sang ma trận ảnh OpenCV
        img = base64_to_cv2(request.imageFrameBase64)
    except Exception as e:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/recognize", CvStatus.INTERNAL_ERROR.value, proc_time)
        return ApiResponse.fail(
            status=CvStatus.INTERNAL_ERROR,
            message=f"Lỗi giải mã hình ảnh Base64: {str(e)}"
        )

    # 2. Kiểm tra phát hiện khuôn mặt
    detect_status, faces = face_detector.detect_faces(img)
    if detect_status != CvStatus.VALID or len(faces) == 0:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/recognize", detect_status.value, proc_time)
        return ApiResponse.fail(
            status=detect_status,
            data=RecognizeResponse(
                matched=False,
                matchedUserId=None,
                similarityScore=0.0,
                status=detect_status.value
            )
        )

    primary_bbox = faces[0]

    # 3. Kiểm tra chất lượng khuôn mặt
    quality_status, _, _ = face_quality_assessor.evaluate_quality(img, primary_bbox)
    if quality_status != CvStatus.VALID:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/recognize", quality_status.value, proc_time)
        return ApiResponse.fail(
            status=quality_status,
            data=RecognizeResponse(
                matched=False,
                matchedUserId=None,
                similarityScore=0.0,
                status=quality_status.value
            )
        )

    # 4. Chuyển đổi danh sách candidates DTO thành Dict
    candidate_dicts = [cand.model_dump() for cand in request.candidates]

    # 5. Thực hiện Matching khuôn mặt với danh sách ứng viên
    rec_status, matched, matched_user_id, score, _ = recognition_service.recognize_face(
        img, primary_bbox, candidate_dicts
    )

    proc_time = (time.time() - start_time) * 1000
    log_inference_metrics(request_id, "/recognize", rec_status.value, proc_time, face_count=1)

    if rec_status == CvStatus.MATCHED:
        return ApiResponse.ok(
            status=CvStatus.MATCHED,
            message=f"Nhận diện thành công nhân viên #{matched_user_id}",
            data=RecognizeResponse(
                matched=True,
                matchedUserId=matched_user_id,
                similarityScore=score,
                status=rec_status.value
            )
        )
    elif rec_status == CvStatus.AMBIGUOUS_MATCH:
        return ApiResponse.fail(
            status=CvStatus.AMBIGUOUS_MATCH,
            message="Phát hiện tranh chấp nhận diện (khoảng cách điểm giữa 2 ứng viên quá gần)",
            data=RecognizeResponse(
                matched=False,
                matchedUserId=matched_user_id,
                similarityScore=score,
                status=rec_status.value
            )
        )
    else:
        return ApiResponse.fail(
            status=CvStatus.UNKNOWN_FACE,
            message="Không tìm thấy khuôn mặt trùng khớp trong danh sách ca làm việc",
            data=RecognizeResponse(
                matched=False,
                matchedUserId=None,
                similarityScore=score,
                status=rec_status.value
            )
        )
