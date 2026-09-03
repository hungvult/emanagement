"""Nạp và quản lý các model ONNX của OpenCV Zoo dùng chung cho toàn service.

Cả hai model đều được nạp một lần duy nhất khi ứng dụng khởi động (lifespan),
không nạp lại theo request. Nếu file model không tồn tại, service vẫn khởi động
được nhưng mọi endpoint xử lý ảnh sẽ trả về MODEL_NOT_READY thay vì âm thầm
dùng một thuật toán thay thế kém chính xác.
"""

import threading
from pathlib import Path
from typing import Any, Optional

import cv2

from app.core.config import settings
from app.core.logging import logger

# Checksum SHA-256 của model chuẩn từ OpenCV Zoo, dùng để phát hiện file tải lỗi.
MODEL_CHECKSUMS: dict[str, str] = {
    "face_detection_yunet_2023mar.onnx": "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    "face_recognition_sface_2021dec.onnx": "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
}

# Gốc của cv-service (thư mục chứa app/), để đường dẫn model trong .env viết tương
# đối vẫn hoạt động bất kể tiến trình được khởi động từ thư mục nào.
SERVICE_ROOT = Path(__file__).resolve().parents[2]


def resolve_model_path(raw_path: str) -> Path:
    path = Path(raw_path)
    return path if path.is_absolute() else SERVICE_ROOT / path



class ModelRegistry:
    """Giữ instance detector (YuNet) và recognizer (SFace) dùng chung."""

    def __init__(self) -> None:
        self._detector: Optional[Any] = None
        self._recognizer: Optional[Any] = None
        self._detector_lock = threading.Lock()
        self._recognizer_lock = threading.Lock()
        self.load_error: Optional[str] = None

    @property
    def is_ready(self) -> bool:
        return self._detector is not None and self._recognizer is not None

    @property
    def detector_ready(self) -> bool:
        return self._detector is not None

    @property
    def recognizer_ready(self) -> bool:
        return self._recognizer is not None

    def load(self) -> None:
        """Nạp cả 2 model. Không raise: lỗi được ghi vào load_error."""
        errors: list[str] = []

        det_path = resolve_model_path(settings.DETECTOR_MODEL_PATH)
        rec_path = resolve_model_path(settings.RECOGNIZER_MODEL_PATH)

        try:
            self._detector = self._create_detector(det_path)
            logger.info(f"Nạp face detector YuNet thành công: {det_path}")
        except Exception as exc:
            self._detector = None
            errors.append(f"detector: {exc}")
            logger.error(f"Không nạp được face detector từ {det_path}: {exc}")

        try:
            self._recognizer = self._create_recognizer(rec_path)
            logger.info(f"Nạp face recognizer SFace thành công: {rec_path}")
        except Exception as exc:
            self._recognizer = None
            errors.append(f"recognizer: {exc}")
            logger.error(f"Không nạp được face recognizer từ {rec_path}: {exc}")

        self.load_error = "; ".join(errors) if errors else None
        if self.load_error:
            logger.error(
                "CV Service khởi động THIẾU MODEL. Chạy `python scripts/download_models.py` "
                "để tải model rồi khởi động lại."
            )

    def _create_detector(self, path: Path) -> Any:
        self._require_file(path)
        return cv2.FaceDetectorYN.create(
            str(path),
            "",
            (320, 320),
            settings.DETECTOR_SCORE_THRESHOLD,
            settings.DETECTOR_NMS_THRESHOLD,
            settings.DETECTOR_TOP_K,
        )

    def _create_recognizer(self, path: Path) -> Any:
        self._require_file(path)
        return cv2.FaceRecognizerSF.create(str(path), "")

    @staticmethod
    def _require_file(path: Path) -> None:
        if not path.is_file():
            raise FileNotFoundError(f"Không tìm thấy file model: {path.resolve()}")
        if path.stat().st_size < 1024:
            raise ValueError(
                f"File model {path} chỉ có {path.stat().st_size} bytes - có thể là git-lfs "
                "pointer chưa được tải về."
            )

    def detect(self, img: Any) -> Any:
        """Chạy detector. Có lock vì cv2.FaceDetectorYN giữ input size nội bộ,
        không an toàn khi nhiều request đổi setInputSize song song."""
        if self._detector is None:
            raise RuntimeError("Face detector chưa được nạp")
        height, width = img.shape[:2]
        with self._detector_lock:
            self._detector.setInputSize((width, height))
            _, faces = self._detector.detect(img)
        return faces

    def align_crop(self, img: Any, face_row: Any) -> Any:
        if self._recognizer is None:
            raise RuntimeError("Face recognizer chưa được nạp")
        with self._recognizer_lock:
            return self._recognizer.alignCrop(img, face_row)

    def feature(self, aligned_face: Any) -> Any:
        if self._recognizer is None:
            raise RuntimeError("Face recognizer chưa được nạp")
        with self._recognizer_lock:
            return self._recognizer.feature(aligned_face)


model_registry = ModelRegistry()
