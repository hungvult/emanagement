"""Kiểm tra vùng khuôn mặt và độ sáng trong luồng chấm công."""

from typing import Any, Dict, Tuple
import cv2
import numpy as np

from app.core.config import settings
from app.core.constants import CvStatus

BBox = Tuple[int, int, int, int]

class FaceQualityAssessor:
    """Đánh giá chất lượng khuôn mặt cơ bản (bbox hợp lệ và nằm trong khung hình).

    Chất lượng chi tiết về độ thật/giả và tính sống đã được mô hình học sâu
    MiniFASNetV2 và mô hình trích xuất đặc trưng SFace đảm nhận.
    Luồng chấm công bật thêm kiểm tra độ sáng bằng require_lighting.
    """

    def evaluate_lighting(self, img: np.ndarray) -> Tuple[CvStatus, float, Dict[str, Any]]:
        """Đo độ sáng ảnh gốc, trước mọi bước chuẩn hóa cho mô hình AI."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray))
        is_too_dark = brightness < settings.BRIGHTNESS_MIN
        score = 0.0 if is_too_dark else 1.0
        return (
            CvStatus.IMAGE_TOO_DARK if is_too_dark else CvStatus.VALID,
            score,
            {
                "brightness": round(brightness, 2),
                "brightness_min": settings.BRIGHTNESS_MIN,
                "is_too_dark": is_too_dark,
                "quality_score": score,
            },
        )

    def evaluate_quality(
        self, img: np.ndarray, bbox: BBox, *, require_lighting: bool = False
    ) -> Tuple[CvStatus, float, Dict[str, Any]]:
        """Đánh giá tổng thể chất lượng khuôn mặt trong bbox."""
        x, y, width, height = bbox
        frame_h, frame_w = img.shape[:2]
        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(frame_w, x + width), min(frame_h, y + height)
        face_crop = img[y1:y2, x1:x2]

        details: Dict[str, Any] = {
            "bbox": [int(x), int(y), int(width), int(height)],
            "face_size_ratio": round(width / float(frame_w), 3) if frame_w else 0.0,
        }

        if face_crop.size == 0:
            details.update({"face_size_valid": False, "face_width": 0, "face_height": 0})
            return CvStatus.FACE_TOO_SMALL, 0.0, details

        details["face_size_valid"] = True
        details["is_blurry"] = False
        details["is_too_dark"] = False
        details["quality_score"] = 1.0
        if require_lighting:
            status, score, lighting_details = self.evaluate_lighting(face_crop)
            details.update(lighting_details)
            return status, score, details

        return CvStatus.VALID, 1.0, details


face_quality_assessor = FaceQualityAssessor()
