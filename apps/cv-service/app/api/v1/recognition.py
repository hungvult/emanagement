"""Endpoint nhận diện khuôn mặt cho luồng chấm công kiosk."""

import time

from fastapi import APIRouter, Depends

from app.core.constants import STATUS_MESSAGES, CvStatus
from app.core.logging import log_inference_metrics
from app.core.security import require_api_key
from app.schemas.common import ApiResponse
from app.schemas.recognition import RecognizeRequest, RecognizeResponse
from app.services.embedding_service import ModelNotReadyError
from app.services.face_detector import face_detector
from app.services.face_quality import face_quality_assessor
from app.services.liveness_service import liveness_detector
from app.services.recognition_service import recognition_service
from app.utils.image_utils import InvalidImageError, base64_to_cv2

router = APIRouter(prefix="/cv", tags=["Recognition"], dependencies=[Depends(require_api_key)])


@router.post("/recognize", response_model=ApiResponse[RecognizeResponse])
def recognize_face(request: RecognizeRequest) -> ApiResponse[RecognizeResponse]:
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"

    def respond_fail(status: CvStatus, message: str | None = None, score: float = 0.0):
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/recognize", status.value, proc_time)
        return ApiResponse.fail(
            status=status,
            message=message,
            data=RecognizeResponse(
                matched=False,
                matchedUserId=None,
                similarityScore=score,
                status=status.value,
            ),
        )

    try:
        img = base64_to_cv2(request.imageFrameBase64)
    except InvalidImageError as exc:
        return respond_fail(CvStatus.INVALID_IMAGE, str(exc))

    detect_status, _faces = face_detector.detect_faces(img)
    if detect_status != CvStatus.VALID:
        return respond_fail(detect_status)

    face = _faces[0]

    quality_status, _, _ = face_quality_assessor.evaluate_quality(img, face.bbox)
    if quality_status != CvStatus.VALID:
        return respond_fail(quality_status)

    # Chống giả mạo trước khi so khớp: ảnh in / màn hình không được phép chấm công.
    spoof_status, _, _, _ = liveness_detector.check_liveness(img, face.bbox)
    if spoof_status != CvStatus.VALID:
        return respond_fail(spoof_status)

    candidate_dicts = [cand.model_dump() for cand in request.candidates]

    try:
        rec_status, matched, matched_user_id, score, _ = recognition_service.recognize_face(
            img, face, candidate_dicts
        )
    except ModelNotReadyError:
        return respond_fail(CvStatus.MODEL_NOT_READY, STATUS_MESSAGES[CvStatus.MODEL_NOT_READY])

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
                status=rec_status.value,
            ),
        )

    if rec_status == CvStatus.AMBIGUOUS_MATCH:
        return ApiResponse.fail(
            status=CvStatus.AMBIGUOUS_MATCH,
            message="Độ tương đồng giữa hai nhân viên quá gần nhau, không thể xác định chính xác.",
            data=RecognizeResponse(
                matched=False,
                matchedUserId=matched_user_id,
                similarityScore=score,
                status=rec_status.value,
            ),
        )

    return ApiResponse.fail(
        status=CvStatus.UNKNOWN_FACE,
        message="Không tìm thấy khuôn mặt trùng khớp trong danh sách ca làm việc.",
        data=RecognizeResponse(
            matched=False,
            matchedUserId=None,
            similarityScore=score,
            status=rec_status.value,
        ),
    )
