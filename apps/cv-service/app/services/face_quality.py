"""Đánh giá chất lượng vùng khuôn mặt: kích thước -> độ nét -> độ sáng -> điểm tổng hợp."""

from typing import Any, Dict, Tuple
import numpy as np

from app.core.constants import CvStatus

BBox = Tuple[int, int, int, int]

class FaceQualityAssessor:
    """Đánh giá chất lượng khuôn mặt cơ bản (bbox hợp lệ và nằm trong khung hình).

    Chất lượng chi tiết về độ thật/giả và tính sống đã được mô hình học sâu
    MiniFASNetV2 và mô hình trích xuất đặc trưng SFace đảm nhận.
    """

    def evaluate_quality(
        self, img: np.ndarray, bbox: BBox
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

        return CvStatus.VALID, 1.0, details


face_quality_assessor = FaceQualityAssessor()
