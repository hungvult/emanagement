"""Ước tính tư thế đầu (yaw / pitch / roll) từ 5 landmark của YuNet.

Bản trước dùng Haar eye cascade: khi không tìm được 2 mắt (rất thường xuyên với
mặt hơi nghiêng) thì trả về yaw = pitch = roll = 0 và kết luận "tư thế hợp lệ" -
tức là fail-open. Bản này dùng landmark luôn có sẵn từ bước phát hiện, và nếu
landmark suy biến (2 mắt trùng nhau) thì trả FACE_POSE_INVALID - fail-closed.

Các hằng số hiệu chuẩn được đặt theo tỉ lệ khuôn mặt chính diện trung bình:
mũi nằm trên đường giữa 2 mắt, và cách đường mắt khoảng 0.62 lần khoảng cách
từ đường mắt xuống đường miệng.
"""

from typing import Any, Dict, Tuple

import numpy as np

from app.core.config import settings
from app.core.constants import CvStatus
from app.services.face_detector import DetectedFace

# Tỉ lệ dọc mũi/(mắt->miệng) của mặt chính diện; lệch khỏi giá trị này là gật/ngửa.
NOMINAL_NOSE_RATIO = 0.62
# Hệ số quy đổi tỉ lệ hình học sang độ, hiệu chuẩn thô trên ảnh webcam chính diện.
YAW_SCALE_DEG = 90.0
PITCH_SCALE_DEG = 90.0
EPSILON = 1e-6


class FacePoseEstimator:
    def estimate_pose(self, face: DetectedFace) -> Tuple[CvStatus, bool, Dict[str, Any]]:
        """Trả về (status, is_valid, {yaw, pitch, roll, is_valid})."""
        right_eye = np.array(face.right_eye, dtype=np.float64)
        left_eye = np.array(face.left_eye, dtype=np.float64)
        nose = np.array(face.nose, dtype=np.float64)
        mouth_mid = (
            np.array(face.mouth_right, dtype=np.float64)
            + np.array(face.mouth_left, dtype=np.float64)
        ) / 2.0

        eye_mid = (right_eye + left_eye) / 2.0
        interocular = float(np.linalg.norm(left_eye - right_eye))

        if interocular < EPSILON:
            # Landmark suy biến -> không kết luận được tư thế, từ chối khung hình.
            return CvStatus.FACE_POSE_INVALID, False, {
                "yaw": 0.0,
                "pitch": 0.0,
                "roll": 0.0,
                "is_valid": False,
                "landmarks_degenerate": True,
            }

        # Roll: độ dốc của đường nối 2 mắt.
        delta = left_eye - right_eye
        roll = float(np.round(np.degrees(np.arctan2(delta[1], delta[0])), 1))

        # Yaw: mũi lệch ngang so với trung điểm 2 mắt, chuẩn hoá theo khoảng cách 2 mắt.
        # Dương = mặt quay về phía bên phải của ảnh.
        yaw = float(np.round(((nose[0] - eye_mid[0]) / interocular) * YAW_SCALE_DEG, 1))

        # Pitch: vị trí dọc của mũi trong khoảng mắt -> miệng.
        # Dương = cúi xuống, âm = ngẩng lên.
        eye_to_mouth = float(mouth_mid[1] - eye_mid[1])
        if abs(eye_to_mouth) < EPSILON:
            pitch = 0.0
        else:
            nose_ratio = float(nose[1] - eye_mid[1]) / eye_to_mouth
            pitch = float(np.round((nose_ratio - NOMINAL_NOSE_RATIO) * PITCH_SCALE_DEG, 1))

        is_valid = (
            abs(yaw) <= settings.MAX_YAW
            and abs(pitch) <= settings.MAX_PITCH
            and abs(roll) <= settings.MAX_ROLL
        )

        pose_data: Dict[str, Any] = {
            "yaw": yaw,
            "pitch": pitch,
            "roll": roll,
            "is_valid": is_valid,
        }

        if not is_valid:
            return CvStatus.FACE_POSE_INVALID, False, pose_data

        return CvStatus.VALID, True, pose_data


face_pose_estimator = FacePoseEstimator()
