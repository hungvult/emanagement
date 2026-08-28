from typing import List, Tuple
import cv2
import numpy as np
from app.core.constants import CvStatus


class FaceDetector:
    def __init__(self) -> None:
        # Sử dụng Haar Cascade Classifier có sẵn trong OpenCV
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.face_cascade = cv2.CascadeClassifier(cascade_path)

    def detect_faces(self, img: np.ndarray) -> Tuple[CvStatus, List[Tuple[int, int, int, int]]]:
        """
        Phát hiện danh sách Bounding Box (x, y, w, h) của các khuôn mặt trong ảnh
        và trả về mã trạng thái kiểm tra số lượng mặt.
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Cân bằng khoang độ sáng ảnh xám (Equalize Histogram) để nhận diện tốt hơn
        gray_eq = cv2.equalizeHist(gray)

        faces = self.face_cascade.detectMultiScale(
            gray_eq,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(80, 80)
        )

        face_list: List[Tuple[int, int, int, int]] = []
        for (x, y, w, h) in faces:
            face_list.append((int(x), int(y), int(w), int(h)))

        face_count = len(face_list)
        if face_count == 0:
            return CvStatus.NO_FACE, []
        elif face_count > 1:
            return CvStatus.MULTIPLE_FACES, face_list
        else:
            return CvStatus.VALID, face_list


face_detector = FaceDetector()
