import time
from fastapi import APIRouter

from app.core.constants import CvStatus
from app.core.logging import log_inference_metrics
from app.schemas.common import ApiResponse
from app.schemas.validation import PoseDto, ValidateFrameRequest, ValidateFrameResponse
from app.services.face_detector import face_detector
from app.services.face_position import face_position_validator
from app.services.face_pose import face_pose_estimator
from app.services.face_quality import face_quality_assessor
from app.services.liveness_service import liveness_detector
from app.utils.image_utils import base64_to_cv2

router = APIRouter(prefix="/cv", tags=["Validation"])


@router.post("/validate-frame", response_model=ApiResponse[ValidateFrameResponse])
def validate_frame(request: ValidateFrameRequest) -> ApiResponse[ValidateFrameResponse]:
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"

    try:
        # 1. Giải mã Base64 sang ma trận ảnh OpenCV
        img = base64_to_cv2(request.image)
    except Exception as e:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/validate-frame", CvStatus.INTERNAL_ERROR.value, proc_time)
        return ApiResponse.fail(
            status=CvStatus.INTERNAL_ERROR,
            message=f"Lỗi giải mã hình ảnh Base64: {str(e)}"
        )

    # 2. Kiểm tra phát hiện mặt & đếm số lượng mặt
    detect_status, faces = face_detector.detect_faces(img)
    face_count = len(faces)

    if detect_status != CvStatus.VALID:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/validate-frame", detect_status.value, proc_time, face_count=face_count)
        empty_pose = PoseDto(yaw=0.0, pitch=0.0, roll=0.0, is_valid=False)
        return ApiResponse.fail(
            status=detect_status,
            data=ValidateFrameResponse(
                face_count=face_count,
                quality_score=0.0,
                position_valid=False,
                pose=empty_pose
            )
        )

    primary_bbox = faces[0]

    # 3. Kiểm tra chất lượng khuôn mặt (Blur, Brightness, Size)
    quality_status, quality_score, quality_details = face_quality_assessor.evaluate_quality(img, primary_bbox)
    if quality_status != CvStatus.VALID:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/validate-frame", quality_status.value, proc_time, face_count=1)
        empty_pose = PoseDto(yaw=0.0, pitch=0.0, roll=0.0, is_valid=False)
        return ApiResponse.fail(
            status=quality_status,
            data=ValidateFrameResponse(
                face_count=1,
                quality_score=quality_score,
                position_valid=False,
                pose=empty_pose,
                details=quality_details
            )
        )

    # 4. Kiểm tra vị trí khuôn mặt trong vùng Scan Zone
    pos_status, _, pos_details = face_position_validator.validate_position(img, primary_bbox)
    if pos_status != CvStatus.VALID:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/validate-frame", pos_status.value, proc_time, face_count=1)
        empty_pose = PoseDto(yaw=0.0, pitch=0.0, roll=0.0, is_valid=False)
        return ApiResponse.fail(
            status=pos_status,
            data=ValidateFrameResponse(
                face_count=1,
                quality_score=quality_score,
                position_valid=False,
                pose=empty_pose,
                details=pos_details
            )
        )

    # 5. Kiểm tra tư thế nghiêng của đầu (Head Pose - Yaw, Pitch, Roll)
    pose_status, _, pose_data = face_pose_estimator.estimate_pose(img, primary_bbox)
    pose_dto = PoseDto(**pose_data)

    if pose_status != CvStatus.VALID:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/validate-frame", pose_status.value, proc_time, face_count=1)
        return ApiResponse.fail(
            status=pose_status,
            data=ValidateFrameResponse(
                face_count=1,
                quality_score=quality_score,
                position_valid=True,
                pose=pose_dto,
                details=quality_details
            )
        )

    # 6. Kiểm tra chống giả mạo khuôn mặt (Anti-Spoofing / Liveness Check)
    spoof_status, is_real, liveness_score, liveness_details = liveness_detector.check_liveness(img, primary_bbox)
    if spoof_status != CvStatus.VALID:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/validate-frame", spoof_status.value, proc_time, face_count=1)
        return ApiResponse.fail(
            status=spoof_status,
            data=ValidateFrameResponse(
                face_count=1,
                quality_score=quality_score,
                position_valid=True,
                pose=pose_dto,
                details={**quality_details, **liveness_details}
            )
        )

    # Tất cả kiểm tra thành công -> Hợp lệ
    proc_time = (time.time() - start_time) * 1000
    log_inference_metrics(request_id, "/validate-frame", CvStatus.VALID.value, proc_time, face_count=1)

    return ApiResponse.ok(
        status=CvStatus.VALID,
        data=ValidateFrameResponse(
            face_count=1,
            quality_score=quality_score,
            position_valid=True,
            pose=pose_dto,
            details={**quality_details, **pos_details, **liveness_details}
        )
    )
