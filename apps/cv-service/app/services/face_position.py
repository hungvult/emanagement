from typing import Tuple, Dict, Any
import numpy as np
from app.core.constants import CvStatus


class FacePositionValidator:
    def validate_position(
        self, img: np.ndarray, bbox: Tuple[int, int, int, int], scan_zone_margin_ratio: float = 0.15
    ) -> Tuple[CvStatus, bool, Dict[str, Any]]:
        """
        Kiểm tra tâm điểm của khuôn mặt có nằm trong vùng Scan Zone hợp lệ hay không.
        Mặc định Scan Zone là vùng trung tâm chiếm 70% diện tích khung hình (lề 15% mỗi cạnh).
        """
        frame_h, frame_w = img.shape[:2]
        x, y, w, h = bbox

        face_center_x = x + w / 2.0
        face_center_y = y + h / 2.0

        min_allowed_x = frame_w * scan_zone_margin_ratio
        max_allowed_x = frame_w * (1.0 - scan_zone_margin_ratio)
        min_allowed_y = frame_h * scan_zone_margin_ratio
        max_allowed_y = frame_h * (1.0 - scan_zone_margin_ratio)

        is_centered = (
            min_allowed_x <= face_center_x <= max_allowed_x
            and min_allowed_y <= face_center_y <= max_allowed_y
        )

        details = {
            "face_center": (round(face_center_x, 1), round(face_center_y, 1)),
            "scan_zone_x": (round(min_allowed_x, 1), round(max_allowed_x, 1)),
            "scan_zone_y": (round(min_allowed_y, 1), round(max_allowed_y, 1)),
            "is_centered": is_centered
        }

        if not is_centered:
            return CvStatus.FACE_NOT_CENTERED, False, details

        return CvStatus.VALID, True, details


face_position_validator = FacePositionValidator()
