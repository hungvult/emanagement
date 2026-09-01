from typing import List, Tuple, Dict, Any
import numpy as np
from app.core.constants import CvStatus


class FaceStabilityChecker:
    def evaluate_stability(
        self, center_history: List[Tuple[float, float]], max_drift_threshold: float = 25.0
    ) -> Tuple[CvStatus, bool, Dict[str, Any]]:
        """
        Đánh giá độ ổn định của vị trí khuôn mặt dựa trên lịch sử tọa độ tâm (center_history)
        của chuỗi 5-10 khung hình liên tiếp.
        """
        if not center_history or len(center_history) < 3:
            # Chưa đủ số lượng khung hình để tính độ ổn định -> Coi như tạm ổn định
            return CvStatus.VALID, True, {"drift_std": 0.0, "frame_count": len(center_history)}

        centers = np.array(center_history, dtype=np.float32)
        # Tính độ lệch chuẩn (Standard Deviation) trên trục X và Y
        std_x = float(np.std(centers[:, 0]))
        std_y = float(np.std(centers[:, 1]))
        total_drift_std = float(np.round(np.sqrt(std_x**2 + std_y**2), 2))

        is_stable = total_drift_std <= max_drift_threshold

        details = {
            "drift_std": total_drift_std,
            "max_drift_threshold": max_drift_threshold,
            "frame_count": len(center_history),
            "is_stable": is_stable
        }

        if not is_stable:
            return CvStatus.FACE_UNSTABLE, False, details

        return CvStatus.VALID, True, details


face_stability_checker = FaceStabilityChecker()
