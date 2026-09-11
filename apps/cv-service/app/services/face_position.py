"""Kiểm tra khuôn mặt có nằm trong vùng quét (scan zone) ở giữa khung hình."""

from typing import Any, Dict, Optional, Tuple

import numpy as np

from app.core.config import settings
from app.core.constants import CvStatus


class FacePositionValidator:
    def validate_position(
        self,
        img: np.ndarray,
        bbox: Tuple[int, int, int, int],
        scan_zone_margin_ratio: Optional[float] = None,
    ) -> Tuple[CvStatus, bool, Dict[str, Any]]:
        """Kiểm tra tâm khuôn mặt có nằm trong Scan Zone hay không.

        Lề của Scan Zone lấy từ settings.CENTER_MARGIN_RATIO để có thể điều chỉnh
        qua .env; tham số scan_zone_margin_ratio chỉ dùng khi cần ghi đè tại chỗ.
        """
        margin = (
            settings.CENTER_MARGIN_RATIO
            if scan_zone_margin_ratio is None
            else scan_zone_margin_ratio
        )
        margin = min(max(margin, 0.0), 0.49)

        frame_h, frame_w = img.shape[:2]
        x, y, w, h = bbox

        face_center_x = x + w / 2.0
        face_center_y = y + h / 2.0

        min_allowed_x = frame_w * margin
        max_allowed_x = frame_w * (1.0 - margin)
        min_allowed_y = frame_h * margin
        max_allowed_y = frame_h * (1.0 - margin)

        is_centered = (
            min_allowed_x <= face_center_x <= max_allowed_x
            and min_allowed_y <= face_center_y <= max_allowed_y
        )

        details: Dict[str, Any] = {
            "face_center": (round(face_center_x, 1), round(face_center_y, 1)),
            "scan_zone_x": (round(min_allowed_x, 1), round(max_allowed_x, 1)),
            "scan_zone_y": (round(min_allowed_y, 1), round(max_allowed_y, 1)),
            "margin_ratio": round(margin, 3),
            "is_centered": is_centered,
        }

        if not is_centered:
            return CvStatus.FACE_NOT_CENTERED, False, details

        return CvStatus.VALID, True, details


face_position_validator = FacePositionValidator()
