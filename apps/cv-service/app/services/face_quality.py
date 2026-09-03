"""Đánh giá chất lượng vùng khuôn mặt: kích thước -> độ nét -> độ sáng -> điểm tổng hợp."""

from typing import Any, Dict, Tuple

import cv2
import numpy as np

from app.core.config import settings
from app.core.constants import CvStatus

BBox = Tuple[int, int, int, int]

# Mốc chuẩn hoá điểm chất lượng: đạt các giá trị này coi như tối đa 1.0.
BLUR_SCORE_CAP = 300.0
FACE_SIZE_CAP = 300.0
IDEAL_BRIGHTNESS = 128.0


class FaceQualityAssessor:
    def check_blur(self, img: np.ndarray) -> Tuple[bool, float]:
        """Phát hiện ảnh mờ bằng Laplacian Variance. Trả về (is_blurry, blur_score)."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        return blur_score < settings.BLUR_THRESHOLD, blur_score

    def check_brightness(self, img: np.ndarray) -> Tuple[bool, float]:
        """Kiểm tra độ sáng trung bình vùng mặt. Trả về (is_valid, brightness_score)."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
        brightness_score = float(np.mean(gray))
        is_valid = settings.BRIGHTNESS_MIN <= brightness_score <= settings.BRIGHTNESS_MAX
        return is_valid, brightness_score

    def check_size(self, bbox: BBox) -> Tuple[bool, int, int]:
        """Kiểm tra bbox có đủ lớn để nhận diện. Trả về (is_valid, width, height)."""
        _, _, width, height = bbox
        return (
            width >= settings.MIN_FACE_SIZE and height >= settings.MIN_FACE_SIZE,
            int(width),
            int(height),
        )

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

        is_valid_size, face_w, face_h = self.check_size(bbox)
        details.update({"face_width": face_w, "face_height": face_h})
        if not is_valid_size:
            details.update({"face_size_valid": False, "is_blurry": False, "is_too_dark": False})
            return CvStatus.FACE_TOO_SMALL, 0.0, details

        details["face_size_valid"] = True

        is_blurry, blur_score = self.check_blur(img)
        details["blur_score"] = round(blur_score, 2)
        details["is_blurry"] = is_blurry
        if is_blurry:
            details["is_too_dark"] = False
            return CvStatus.IMAGE_TOO_BLURRY, 0.0, details

        brightness_valid, brightness_score = self.check_brightness(face_crop)
        details["brightness_score"] = round(brightness_score, 2)
        details["is_too_dark"] = not brightness_valid
        if not brightness_valid:
            return CvStatus.IMAGE_TOO_DARK, 0.0, details

        norm_blur = min(1.0, blur_score / BLUR_SCORE_CAP)
        norm_brightness = max(
            0.0, 1.0 - abs(brightness_score - IDEAL_BRIGHTNESS) / IDEAL_BRIGHTNESS
        )
        norm_size = min(1.0, min(face_w, face_h) / FACE_SIZE_CAP)

        quality_score = float(
            np.round(norm_blur * 0.4 + norm_brightness * 0.3 + norm_size * 0.3, 2)
        )
        details["quality_score"] = quality_score

        if quality_score < settings.MIN_QUALITY_SCORE:
            return CvStatus.LOW_FACE_QUALITY, quality_score, details

        return CvStatus.VALID, quality_score, details


face_quality_assessor = FaceQualityAssessor()
