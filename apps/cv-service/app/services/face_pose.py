from typing import Tuple, Dict, Any
import cv2
import numpy as np
from app.core.config import settings
from app.core.constants import CvStatus


class FacePoseEstimator:
    def __init__(self) -> None:
        eye_cascade_path = cv2.data.haarcascades + "haarcascade_eye.xml"
        self.eye_cascade = cv2.CascadeClassifier(eye_cascade_path)

    def estimate_pose(
        self, img: np.ndarray, bbox: Tuple[int, int, int, int]
    ) -> Tuple[CvStatus, bool, Dict[str, Any]]:
        """
        Ước tính góc nghiêng của đầu (Yaw, Pitch, Roll) dựa trên vị trí đối xứng của mắt và tỷ lệ hình học.
        """
        x, y, w, h = bbox
        face_crop = img[y : y + h, x : x + w]
        gray_face = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) if len(face_crop.shape) == 3 else face_crop

        eyes = self.eye_cascade.detectMultiScale(gray_face, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))

        yaw, pitch, roll = 0.0, 0.0, 0.0

        if len(eyes) >= 2:
            # Sắp xếp 2 mắt theo trục X (mắt trái, mắt phải)
            sorted_eyes = sorted(eyes, key=lambda e: e[0])
            ex1, ey1, ew1, eh1 = sorted_eyes[0]
            ex2, ey2, ew2, eh2 = sorted_eyes[1]

            eye1_center = (ex1 + ew1 / 2.0, ey1 + eh1 / 2.0)
            eye2_center = (ex2 + ew2 / 2.0, ey2 + eh2 / 2.0)

            # Tính độ nghiêng mặt (Roll angle) dựa trên góc dốc giữa 2 mắt
            dx = eye2_center[0] - eye1_center[0]
            dy = eye2_center[1] - eye1_center[1]
            if dx != 0:
                roll = float(np.round(np.degrees(np.arctan2(dy, dx)), 1))

            # Tính độ lệch trái/phải (Yaw angle) dựa trên tâm giữa 2 mắt so với trung điểm khuôn mặt
            eye_mid_x = (eye1_center[0] + eye2_center[0]) / 2.0
            face_mid_x = w / 2.0
            yaw = float(np.round(((eye_mid_x - face_mid_x) / w) * 60.0, 1))

            # Tính độ gật/ngửa (Pitch angle) dựa trên vị trí trung tâm mắt theo chiều đứng
            eye_mid_y = (eye1_center[1] + eye2_center[1]) / 2.0
            pitch = float(np.round(((eye_mid_y - (h * 0.35)) / h) * 45.0, 1))

        is_valid = (
            abs(yaw) <= settings.MAX_YAW
            and abs(pitch) <= settings.MAX_PITCH
            and abs(roll) <= settings.MAX_ROLL
        )

        pose_data = {
            "yaw": yaw,
            "pitch": pitch,
            "roll": roll,
            "is_valid": is_valid
        }

        if not is_valid:
            return CvStatus.FACE_POSE_INVALID, False, pose_data

        return CvStatus.VALID, True, pose_data


face_pose_estimator = FacePoseEstimator()
