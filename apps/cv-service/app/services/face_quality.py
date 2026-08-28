from typing import Tuple, Dict, Any
import cv2
import numpy as np
from app.core.config import settings
from app.core.constants import CvStatus


class FaceQualityAssessor:
    def check_blur(self, img: np.ndarray) -> Tuple[bool, float]:
        """
        Kiểm tra ảnh mờ bằng thuật toán Laplacian Variance.
        Trả về (is_blurry, blur_score).
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        is_blurry = blur_score < settings.BLUR_THRESHOLD
        return is_blurry, float(blur_score)

    def check_brightness(self, img: np.ndarray) -> Tuple[bool, float]:
        """
        Kiểm tra độ sáng trung bình của ảnh (vùng mặt).
        Trả về (is_valid, brightness_score).
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        brightness_score = float(np.mean(gray))
        is_valid = settings.BRIGHTNESS_MIN <= brightness_score <= settings.BRIGHTNESS_MAX
        return is_valid, brightness_score

    def check_size(self, bbox: Tuple[int, int, int, int]) -> Tuple[bool, int, int]:
        """
        Kiểm tra kích thước chiều rộng và chiều cao của Bounding Box.
        Trả về (is_valid_size, width, height).
        """
        _, _, w, h = bbox
        is_valid_size = (w >= settings.MIN_FACE_SIZE) and (h >= settings.MIN_FACE_SIZE)
        return is_valid_size, w, h

    def evaluate_quality(
        self, img: np.ndarray, bbox: Tuple[int, int, int, int]
    ) -> Tuple[CvStatus, float, Dict[str, Any]]:
        """
        Đánh giá tổng thể chất lượng khuôn mặt theo các tiêu chí:
        Blur -> Brightness -> Size -> Quality Score.
        """
        x, y, w, h = bbox
        face_crop = img[y : y + h, x : x + w]
        if face_crop.size == 0:
            face_crop = img

        is_valid_size, face_w, face_h = self.check_size(bbox)
        if not is_valid_size:
            return CvStatus.FACE_TOO_SMALL, 0.0, {
                "is_blurry": False,
                "is_too_dark": False,
                "face_size_valid": False,
                "face_width": face_w,
                "face_height": face_h
            }

        is_blurry, blur_score = self.check_blur(face_crop)
        if is_blurry:
            return CvStatus.IMAGE_TOO_BLURRY, 0.0, {
                "is_blurry": True,
                "blur_score": round(blur_score, 2),
                "is_too_dark": False,
                "face_size_valid": True
            }

        brightness_valid, brightness_score = self.check_brightness(face_crop)
        if not brightness_valid:
            return CvStatus.IMAGE_TOO_DARK, 0.0, {
                "is_blurry": False,
                "is_too_dark": True,
                "brightness_score": round(brightness_score, 2),
                "face_size_valid": True
            }

        # Tính toán Quality Score tổng hợp (từ 0.0 đến 1.0)
        norm_blur = min(1.0, blur_score / 300.0)
        norm_brightness = 1.0 - abs(brightness_score - 128.0) / 128.0
        norm_size = min(1.0, min(w, h) / 300.0)

        quality_score = float(np.round((norm_blur * 0.4 + norm_brightness * 0.3 + norm_size * 0.3), 2))

        if quality_score < settings.MIN_QUALITY_SCORE:
            return CvStatus.LOW_FACE_QUALITY, quality_score, {
                "is_blurry": False,
                "is_too_dark": False,
                "face_size_valid": True,
                "quality_score": quality_score
            }

        return CvStatus.VALID, quality_score, {
            "is_blurry": False,
            "is_too_dark": False,
            "face_size_valid": True,
            "quality_score": quality_score,
            "blur_score": round(blur_score, 2),
            "brightness_score": round(brightness_score, 2)
        }


face_quality_assessor = FaceQualityAssessor()
