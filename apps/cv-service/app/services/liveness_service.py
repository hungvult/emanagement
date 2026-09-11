"""Kiểm tra tính sống (liveness / anti-spoofing) bằng đặc trưng ảnh cổ điển.

Giới hạn cần biết: đây là heuristic dựa trên phổ tần số và độ biến thiên màu, chỉ
lọc được ảnh in mờ và màn hình có moiré rõ. Nó KHÔNG phải anti-spoofing chuẩn
sản xuất và có thể bị vượt qua bằng ảnh in chất lượng cao hoặc màn hình độ phân
giải cao. Vì vậy nó có thể tắt qua LIVENESS_ENABLED, và ngưỡng đặt trong
LIVENESS_THRESHOLD để hiệu chuẩn theo camera thực tế thay vì hard-code.
"""

from typing import Any, Dict, Tuple

import cv2
import numpy as np

from app.core.config import settings
from app.core.constants import CvStatus
from app.utils.image_utils import crop_face

HIGH_FREQ_CAP = 180.0
SAT_STD_CAP = 50.0


class LivenessDetector:
    def check_liveness(
        self, img: np.ndarray, bbox: Tuple[int, int, int, int]
    ) -> Tuple[CvStatus, bool, float, Dict[str, Any]]:
        """Trả về (status, is_real, liveness_score, details)."""
        if not settings.LIVENESS_ENABLED:
            return CvStatus.VALID, True, 1.0, {"liveness_enabled": False, "is_real": True}

        face_crop = crop_face(img, bbox, margin_ratio=0.1)
        if face_crop.size == 0:
            face_crop = img

        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)

        # 1. Phân tích phổ tần số (FFT): ảnh in và màn hình có phân bố tần số cao
        # bị cắt đột ngột hoặc lẫn nhiễu sọc (moiré).
        f_shift = np.fft.fftshift(np.fft.fft2(gray))
        magnitude_spectrum = 20 * np.log(np.abs(f_shift) + 1e-8)

        h, w = gray.shape
        cy, cx = h // 2, w // 2
        radius = max(1, min(h, w) // 6)
        mask = np.ones((h, w), dtype=np.uint8)
        cv2.circle(mask, (int(cx), int(cy)), int(radius), (0,), -1)
        high_freq_energy = float(np.mean(magnitude_spectrum * mask))

        # 2. Độ biến thiên bão hoà màu: bản in/màn hình thường phẳng màu hơn da thật.
        hsv = cv2.cvtColor(face_crop, cv2.COLOR_BGR2HSV)
        sat_std = float(np.std(hsv[:, :, 1]))

        # 3. Phân tích sắc tố da thật (Skin Chrominance) trong không gian YCrCb:
        # Da người thật có vùng Cb và Cr hội tụ đặc trưng.
        # Mở rộng dải thích ứng với nhiều loại webcam và ánh sáng phòng khác nhau.
        ycrcb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2YCrCb)
        cr = ycrcb[:, :, 1]
        cb = ycrcb[:, :, 2]
        skin_mask = (cr >= 115) & (cr <= 185) & (cb >= 68) & (cb <= 145)
        skin_ratio = float(np.sum(skin_mask) / (skin_mask.size + 1e-5))

        # 4. Phân tích kết cấu vi mô bề mặt (Laplacian micro-texture variance):
        # Ảnh webcam nén JPEG 640px có độ sắc nét tự nhiên var ~5.0 - 40.0.
        # Chỉ phạt nhẹ khi ảnh hoàn toàn phẳng/nhòe nhân tạo (var < 3.0).
        lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        texture_penalty = 0.12 if lap_var < 3.0 else (0.05 if lap_var < 5.0 else 0.0)

        # 5. Kiểm tra vệt lóa phản chiếu ánh sáng trên mặt kính điện thoại (Specular glare):
        # Chỉ phạt khi vùng lóa trắng chiếm diện tích bất thường (> 18% diện tích mặt).
        glare_pixels = np.sum((face_crop[:, :, 0] > 238) & (face_crop[:, :, 1] > 238) & (face_crop[:, :, 2] > 238) & (hsv[:, :, 1] < 35))
        glare_ratio = float(glare_pixels / (face_crop.shape[0] * face_crop.shape[1] + 1e-5))
        glare_penalty = 0.15 if glare_ratio > 0.18 else (0.08 if glare_ratio > 0.12 else 0.0)

        norm_high_freq = min(1.0, max(0.0, high_freq_energy / HIGH_FREQ_CAP))
        norm_sat = min(1.0, max(0.0, sat_std / SAT_STD_CAP))
        norm_skin = min(1.0, max(0.0, skin_ratio * 1.4))

        liveness_score = float(np.round(0.45 * norm_high_freq + 0.35 * norm_sat + 0.20 * norm_skin - texture_penalty - glare_penalty, 2))
        is_real = liveness_score >= settings.LIVENESS_THRESHOLD

        details: Dict[str, Any] = {
            "liveness_enabled": True,
            "liveness_score": liveness_score,
            "liveness_threshold": settings.LIVENESS_THRESHOLD,
            "high_freq_energy": round(high_freq_energy, 2),
            "color_sat_std": round(sat_std, 2),
            "laplacian_var": round(lap_var, 2),
            "glare_ratio": round(glare_ratio, 4),
            "is_real": is_real,
        }

        if not is_real:
            return CvStatus.SPOOF_DETECTED, False, liveness_score, details

        return CvStatus.VALID, True, liveness_score, details


liveness_detector = LivenessDetector()
