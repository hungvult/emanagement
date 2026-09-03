"""Trích xuất vector đặc trưng khuôn mặt bằng SFace (OpenCV Zoo).

Đặc điểm quan trọng cho hệ thống chấm công:

* **Tất định (deterministic).** Model là file ONNX đã huấn luyện sẵn, cùng một ảnh
  luôn cho ra cùng một vector kể cả sau khi restart service. Vector đã lưu trong
  cơ sở dữ liệu vì thế dùng lại được lâu dài.
* **Có căn chỉnh (alignment).** Ảnh mặt được `alignCrop` về 112x112 theo 5 landmark
  do YuNet trả về trước khi đưa vào model, nên vector ít bị ảnh hưởng bởi vị trí,
  kích thước và độ nghiêng của mặt trong khung hình.
* **Không có đường dự phòng âm thầm.** Nếu model chưa nạp được, hàm raise
  ModelNotReadyError để tầng API trả về MODEL_NOT_READY, thay vì tạo ra vector
  bằng một thuật toán khác (histogram, ...) không so sánh được với dữ liệu cũ.
"""

from typing import List

import numpy as np

from app.core.config import settings
from app.core.logging import logger
from app.core.models import model_registry
from app.services.face_detector import DetectedFace


class ModelNotReadyError(RuntimeError):
    """Model nhận diện chưa sẵn sàng."""


class EmbeddingService:
    def load_model(self) -> None:
        model_registry.load()

    @property
    def is_ready(self) -> bool:
        return model_registry.is_ready

    def extract_embedding(self, img: np.ndarray, face: DetectedFace) -> List[float]:
        """Trả về vector đặc trưng 128 chiều đã L2-normalize."""
        if not model_registry.recognizer_ready:
            raise ModelNotReadyError("Face recognizer chưa được nạp")

        aligned = model_registry.align_crop(img, face.raw)
        raw_vector = np.asarray(model_registry.feature(aligned), dtype=np.float32).flatten()

        if raw_vector.size != settings.EMBEDDING_DIMENSION:
            logger.warning(
                f"Model trả về vector {raw_vector.size} chiều, cấu hình mong đợi "
                f"{settings.EMBEDDING_DIMENSION} chiều."
            )

        return normalize_vector(raw_vector)


def normalize_vector(vector: np.ndarray) -> List[float]:
    """L2-normalize và làm tròn 6 chữ số thập phân để vector lưu DB ngắn gọn."""
    array = np.asarray(vector, dtype=np.float32).flatten()
    norm = float(np.linalg.norm(array))
    if norm > 0.0:
        array = array / norm
    return [float(np.round(value, 6)) for value in array]


def average_embeddings(vectors: List[List[float]]) -> List[float]:
    """Gộp nhiều vector của cùng một người thành một vector đại diện.

    Lấy trung bình rồi L2-normalize lại - cách gộp chuẩn cho embedding đã normalize,
    giúp vector đại diện bớt phụ thuộc vào một góc mặt cụ thể.
    """
    if not vectors:
        raise ValueError("Danh sách vector rỗng")
    mean_vector = np.mean(np.asarray(vectors, dtype=np.float32), axis=0)
    return normalize_vector(mean_vector)


embedding_service = EmbeddingService()
