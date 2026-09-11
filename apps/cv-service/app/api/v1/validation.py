"""Endpoint kiểm tra khung hình trực tiếp cho UI eKYC / kiosk.

Thứ tự kiểm tra đi từ rẻ đến đắt và từ tổng quát đến chi tiết: phát hiện mặt ->
chất lượng -> vị trí -> tư thế -> chống giả mạo. Mỗi bước thất bại trả về ngay
kèm mã CvStatus để frontend hiển thị hướng dẫn tương ứng.
"""

import time
from typing import Any, Dict

from fastapi import APIRouter, Depends

from app.core.constants import CvStatus
from app.core.logging import log_inference_metrics
from app.core.security import require_api_key
from app.schemas.common import ApiResponse
from app.schemas.validation import PoseDto, ValidateFrameRequest, ValidateFrameResponse
from app.services.face_detector import face_detector
from app.services.face_position import face_position_validator
from app.services.face_pose import face_pose_estimator
from app.services.face_quality import face_quality_assessor
from app.services.liveness_service import liveness_detector
from app.utils.image_utils import InvalidImageError, base64_to_cv2

router = APIRouter(prefix="/cv", tags=["Validation"], dependencies=[Depends(require_api_key)])

EMPTY_POSE = PoseDto(yaw=0.0, pitch=0.0, roll=0.0, is_valid=False)


def _fail(
    request_id: str,
    start_time: float,
    status: CvStatus,
    *,
    face_count: int = 0,
    quality_score: float = 0.0,
    position_valid: bool = False,
    pose: PoseDto = EMPTY_POSE,
    details: Dict[str, Any] | None = None,
    message: str | None = None,
) -> ApiResponse[ValidateFrameResponse]:
    proc_time = (time.time() - start_time) * 1000
    log_inference_metrics(
        request_id, "/validate-frame", status.value, proc_time, face_count=face_count
    )
    return ApiResponse.fail(
        status=status,
        message=message,
        data=ValidateFrameResponse(
            face_count=face_count,
            quality_score=quality_score,
            position_valid=position_valid,
            pose=pose,
            details=details or {},
        ),
    )


@router.post("/validate-frame", response_model=ApiResponse[ValidateFrameResponse])
def validate_frame(request: ValidateFrameRequest) -> ApiResponse[ValidateFrameResponse]:
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"

    try:
        img = base64_to_cv2(request.image)
    except InvalidImageError as exc:
        return _fail(request_id, start_time, CvStatus.INVALID_IMAGE, message=str(exc))

    detect_status, faces = face_detector.detect_faces(img)
    if detect_status != CvStatus.VALID:
        return _fail(request_id, start_time, detect_status, face_count=len(faces))

    face = faces[0]

    quality_status, quality_score, quality_details = face_quality_assessor.evaluate_quality(
        img, face.bbox
    )
    quality_details["detector_score"] = round(face.score, 3)
    if quality_status != CvStatus.VALID:
        return _fail(
            request_id,
            start_time,
            quality_status,
            face_count=1,
            quality_score=quality_score,
            details=quality_details,
        )

    pos_status, _, pos_details = face_position_validator.validate_position(img, face.bbox)
    if pos_status != CvStatus.VALID:
        return _fail(
            request_id,
            start_time,
            pos_status,
            face_count=1,
            quality_score=quality_score,
            details={**quality_details, **pos_details},
        )

    pose_status, _, pose_data = face_pose_estimator.estimate_pose(face)
    pose_dto = PoseDto(
        yaw=pose_data["yaw"],
        pitch=pose_data["pitch"],
        roll=pose_data["roll"],
        is_valid=pose_data["is_valid"],
    )
    if pose_status != CvStatus.VALID:
        return _fail(
            request_id,
            start_time,
            pose_status,
            face_count=1,
            quality_score=quality_score,
            position_valid=True,
            pose=pose_dto,
            details={**quality_details, **pos_details, **pose_data},
        )

    spoof_status, _, _, liveness_details = liveness_detector.check_liveness(img, face.bbox)
    if spoof_status != CvStatus.VALID:
        return _fail(
            request_id,
            start_time,
            spoof_status,
            face_count=1,
            quality_score=quality_score,
            position_valid=True,
            pose=pose_dto,
            details={**quality_details, **pos_details, **liveness_details},
        )

    proc_time = (time.time() - start_time) * 1000
    log_inference_metrics(request_id, "/validate-frame", CvStatus.VALID.value, proc_time, face_count=1)

    return ApiResponse.ok(
        status=CvStatus.VALID,
        data=ValidateFrameResponse(
            face_count=1,
            quality_score=quality_score,
            position_valid=True,
            pose=pose_dto,
            details={**quality_details, **pos_details, **pose_data, **liveness_details},
        ),
    )
