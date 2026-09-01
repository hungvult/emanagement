from typing import Tuple, Dict, Any
import cv2
import numpy as np
from app.core.constants import CvStatus
from app.utils.image_utils import crop_face


class LivenessDetector:
    def check_liveness(
        self, img: np.ndarray, bbox: Tuple[int, int, int, int]
    ) -> Tuple[CvStatus, bool, float, Dict[str, Any]]:
        """
        Kiểm tra tính sống (Liveness / Anti-Spoofing) để chống lại các hình thức giả mạo:
        1. Ảnh in trên giấy (2D Printed Photo)
        2. Video tái phát lại trên màn hình điện thoại/máy tính (Replay Attack)

        Trả về (status, is_real, liveness_score, details).
        """
        face_crop = crop_face(img, bbox, margin_ratio=0.1)
        if face_crop.size == 0:
            face_crop = img

        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)

        # 1. Phân tích phổ tần số bằng Fast Fourier Transform (FFT)
        # Màn hình điện thoại và ảnh in có phân bố tần số cao cắt đột ngột hoặc nhiễu sọc (Moiré patterns)
        f_transform = np.fft.fft2(gray)
        f_shift = np.fft.fftshift(f_transform)
        magnitude_spectrum = 20 * np.log(np.abs(f_shift) + 1e-8)
        
        # Tính năng lượng tần số cao
        h, w = gray.shape
        cy, cx = h // 2, w // 2
        r = min(h, w) // 6
        mask = np.ones((h, w), dtype=np.uint8)
        cv2.circle(mask, (int(cx), int(cy)), int(r), (0,), -1)
        high_freq_energy = float(np.mean(magnitude_spectrum * mask))

        # 2. Phân tích độ biến thiên màu sắc trong không gian HSV & YCrCb
        hsv = cv2.cvtColor(face_crop, cv2.COLOR_BGR2HSV)
        sat_std = float(np.std(hsv[:, :, 1]))  # Độ lệch chuẩn của kênh bão hòa màu

        # 3. Tổng hợp điểm Liveness Score (0.0 đến 1.0)
        norm_high_freq = min(1.0, high_freq_energy / 180.0)
        norm_sat = min(1.0, sat_std / 50.0)

        liveness_score = float(np.round(0.6 * norm_high_freq + 0.4 * norm_sat, 2))

        # Ngưỡng phát hiện giả mạo (Giả mạo nếu điểm < 0.35)
        is_real = liveness_score >= 0.35

        details = {
            "liveness_score": liveness_score,
            "high_freq_energy": round(high_freq_energy, 2),
            "color_sat_std": round(sat_std, 2),
            "is_real": is_real
        }

        if not is_real:
            return CvStatus.SPOOF_DETECTED, False, liveness_score, details

        return CvStatus.VALID, True, liveness_score, details


liveness_detector = LivenessDetector()
