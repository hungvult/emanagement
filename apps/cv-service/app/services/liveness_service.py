"""Kiểm tra tính sống (Liveness / Anti-Spoofing) bằng mô hình học sâu MiniFASNetV2.

Mô hình MiniFASNetV2 (Silent-Face-Anti-Spoofing) phân loại khuôn mặt vào 3 lớp:
  0: Paper Photo (ảnh in giấy)
  1: Real Face (khuôn mặt thật)
  2: Screen Photo / Replay (ảnh / video phát lại trên màn hình điện thoại/máy tính)

Thay thế hoàn toàn các phương pháp heuristic cũ (FFT, phổ màu YCrCb, HSV std,
Laplacian micro-texture), ngăn chặn triệt để hành vi quay video người chớp mắt
trên điện thoại để gian lận chấm công.
"""

from typing import Any, Dict, Tuple

import cv2
import numpy as np

from app.core.config import settings
from app.core.constants import CvStatus
from app.core.logging import logger
from app.core.models import model_registry


class LivenessDetector:
    """Bộ phát hiện giả mạo khuôn mặt (Anti-Spoofing) sử dụng mô hình MiniFASNetV2."""

    LABEL_NAMES = ["Paper Photo", "Real Face", "Screen Photo"]

    def _get_new_box(
        self, src_w: int, src_h: int, bbox: Tuple[int, int, int, int] | list, scale: float
    ) -> Tuple[int, int, int, int]:
        """Tính toán bounding box mở rộng theo hệ số scale (chuẩn MiniFASNet)."""
        x, y, box_w, box_h = bbox[:4]

        # Giới hạn scale không vượt quá kích thước ảnh
        scale = min((src_h - 1) / max(1, box_h), min((src_w - 1) / max(1, box_w), scale))

        new_width = box_w * scale
        new_height = box_h * scale
        center_x = box_w / 2.0 + x
        center_y = box_h / 2.0 + y

        left_top_x = center_x - new_width / 2.0
        left_top_y = center_y - new_height / 2.0
        right_bottom_x = center_x + new_width / 2.0
        right_bottom_y = center_y + new_height / 2.0

        # Xử lý biên: nếu tràn mép thì bù sang phía đối diện để giữ nguyên kích thước
        if left_top_x < 0:
            right_bottom_x -= left_top_x
            left_top_x = 0

        if left_top_y < 0:
            right_bottom_y -= left_top_y
            left_top_y = 0

        if right_bottom_x > src_w - 1:
            left_top_x -= right_bottom_x - src_w + 1
            right_bottom_x = src_w - 1

        if right_bottom_y > src_h - 1:
            left_top_y -= right_bottom_y - src_h + 1
            right_bottom_y = src_h - 1

        return (
            int(max(0, left_top_x)),
            int(max(0, left_top_y)),
            int(min(src_w - 1, right_bottom_x)),
            int(min(src_h - 1, right_bottom_y)),
        )

    def check_liveness(
        self, img: np.ndarray, bbox: Tuple[int, int, int, int]
    ) -> Tuple[CvStatus, bool, float, Dict[str, Any]]:
        """Kiểm tra tính sống của khuôn mặt.

        Trả về: (status, is_real, liveness_score, details)
        """
        if not settings.LIVENESS_ENABLED:
            return CvStatus.VALID, True, 1.0, {"liveness_enabled": False, "is_real": True}

        if not model_registry.anti_spoof_ready:
            logger.error("Anti-spoof model (MiniFASNetV2) chưa sẵn sàng.")
            return (
                CvStatus.MODEL_NOT_READY,
                False,
                0.0,
                {
                    "liveness_enabled": True,
                    "model": "MiniFASNetV2",
                    "error": "Model not ready",
                    "is_real": False,
                },
            )

        src_h, src_w = img.shape[:2]
        x1, y1, x2, y2 = self._get_new_box(src_w, src_h, bbox, settings.ANTI_SPOOF_SCALE)
        face_crop = img[y1 : y2 + 1, x1 : x2 + 1]

        if face_crop.size == 0:
            face_crop = img

        face_resized = cv2.resize(face_crop, (80, 80))

        # MiniFASNet yêu cầu đầu vào BGR trong dải pixel [0, 255] (không swap RB, không chia 255)
        blob = cv2.dnn.blobFromImage(
            face_resized,
            scalefactor=1.0,
            size=(80, 80),
            mean=(0, 0, 0),
            swapRB=False,
            crop=False,
        )

        try:
            raw_output = model_registry.predict_anti_spoof(blob)
            exp_out = np.exp(raw_output - np.max(raw_output, axis=1, keepdims=True))
            probs = exp_out / np.sum(exp_out, axis=1, keepdims=True)
            scores = probs[0]

            paper_prob = float(scores[0])
            real_prob = float(scores[1])
            screen_prob = float(scores[2])

            label_idx = int(np.argmax(scores))
            label_text = (
                self.LABEL_NAMES[label_idx]
                if label_idx < len(self.LABEL_NAMES)
                else "Unknown"
            )

            # Khuôn mặt thật nếu lớp chiếm ưu thế là Real Face và xác suất >= ngưỡng
            is_real = (label_idx == 1) and (real_prob >= settings.LIVENESS_THRESHOLD)
            liveness_score = round(real_prob, 4)

            details: Dict[str, Any] = {
                "liveness_enabled": True,
                "model": "MiniFASNetV2",
                "liveness_score": liveness_score,
                "liveness_threshold": settings.LIVENESS_THRESHOLD,
                "label": label_idx,
                "label_text": label_text,
                "is_real": is_real,
                "probabilities": {
                    "paper": round(paper_prob, 4),
                    "real": round(real_prob, 4),
                    "screen": round(screen_prob, 4),
                },
            }

            if not is_real:
                logger.info(
                    f"Phát hiện giả mạo khuôn mặt: label={label_text}, "
                    f"scores=[paper={paper_prob:.3f}, real={real_prob:.3f}, screen={screen_prob:.3f}], "
                    f"threshold={settings.LIVENESS_THRESHOLD}"
                )
                return CvStatus.SPOOF_DETECTED, False, liveness_score, details

            return CvStatus.VALID, True, liveness_score, details

        except Exception as exc:
            logger.error(f"Lỗi suy luận Anti-Spoofing: {exc}", exc_info=True)
            return (
                CvStatus.SPOOF_DETECTED,
                False,
                0.0,
                {"liveness_enabled": True, "error": str(exc), "is_real": False},
            )


liveness_detector = LivenessDetector()
