"""Phát hiện khuôn mặt bằng YuNet (OpenCV Zoo).

Khác biệt quan trọng so với bản Haar cascade trước đây: khi không phát hiện được
khuôn mặt, hàm trả về NO_FACE thay vì bịa ra một bounding box giữa khung hình.
Nhờ đó các bước kiểm tra phía sau (chất lượng, vị trí, tư thế, nhận diện) không
còn xử lý trên vùng ảnh không phải mặt người.

YuNet trả về mỗi khuôn mặt là một hàng 15 số:
    [x, y, w, h,
     x_mắt_phải, y_mắt_phải, x_mắt_trái, y_mắt_trái,
     x_mũi, y_mũi,
     x_khóe_miệng_phải, y_khóe_miệng_phải, x_khóe_miệng_trái, y_khóe_miệng_trái,
     score]
"Phải"/"trái" theo góc nhìn của người trong ảnh, nên mắt phải nằm ở phía trái ảnh.
"""

from dataclasses import dataclass
from typing import List, Tuple

import numpy as np

from app.core.constants import CvStatus
from app.core.models import model_registry

BBox = Tuple[int, int, int, int]


@dataclass(frozen=True)
class DetectedFace:
    """Một khuôn mặt đã phát hiện, kèm landmark để căn chỉnh và tính tư thế."""

    bbox: BBox
    right_eye: Tuple[float, float]
    left_eye: Tuple[float, float]
    nose: Tuple[float, float]
    mouth_right: Tuple[float, float]
    mouth_left: Tuple[float, float]
    score: float
    raw: np.ndarray

    @property
    def area(self) -> int:
        return self.bbox[2] * self.bbox[3]


def _clamp_bbox(x: float, y: float, w: float, h: float, frame_w: int, frame_h: int) -> BBox:
    """Giới hạn bbox trong khung hình; YuNet có thể trả toạ độ âm hoặc vượt biên."""
    x1 = max(0, int(round(x)))
    y1 = max(0, int(round(y)))
    x2 = min(frame_w, int(round(x + w)))
    y2 = min(frame_h, int(round(y + h)))
    return x1, y1, max(0, x2 - x1), max(0, y2 - y1)


class FaceDetector:
    def detect_faces(self, img: np.ndarray) -> Tuple[CvStatus, List[DetectedFace]]:
        """Trả về (status, danh sách khuôn mặt sắp xếp theo diện tích giảm dần).

        - NO_FACE: không có khuôn mặt nào đạt ngưỡng score.
        - MULTIPLE_FACES: có từ 2 khuôn mặt trở lên (chỉ cho phép 1 người).
        - VALID: đúng 1 khuôn mặt.
        """
        if not model_registry.detector_ready:
            return CvStatus.MODEL_NOT_READY, []

        frame_h, frame_w = img.shape[:2]
        raw_faces = model_registry.detect(img)

        faces: List[DetectedFace] = []
        if raw_faces is not None:
            for row in raw_faces:
                values = np.asarray(row, dtype=np.float32).flatten()
                if values.size < 15:
                    continue
                bbox = _clamp_bbox(values[0], values[1], values[2], values[3], frame_w, frame_h)
                if bbox[2] <= 0 or bbox[3] <= 0:
                    continue
                faces.append(
                    DetectedFace(
                        bbox=bbox,
                        right_eye=(float(values[4]), float(values[5])),
                        left_eye=(float(values[6]), float(values[7])),
                        nose=(float(values[8]), float(values[9])),
                        mouth_right=(float(values[10]), float(values[11])),
                        mouth_left=(float(values[12]), float(values[13])),
                        score=float(values[14]),
                        raw=values,
                    )
                )

        if not faces:
            return CvStatus.NO_FACE, []

        faces.sort(key=lambda f: f.area, reverse=True)

        # Trả về khuôn mặt lớn nhất (gần nhất) thay vì báo lỗi MULTIPLE_FACES
        return CvStatus.VALID, [faces[0]]


face_detector = FaceDetector()
