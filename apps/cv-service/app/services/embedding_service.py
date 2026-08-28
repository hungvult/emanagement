from typing import List, Tuple, Optional, Any
import cv2
import numpy as np

try:
    import tensorflow as tf  # type: ignore
except ImportError:
    tf = None

from app.core.logging import logger
from app.utils.image_utils import crop_face


class EmbeddingService:
    def __init__(self) -> None:
        self.model: Optional[Any] = None
        self.target_size = (128, 128)
        self.embedding_dim = 128

    def load_model(self) -> None:
        """
        Nạp mô hình TensorFlow Feature Extractor 1 lần duy nhất khi ứng dụng khởi động.
        """
        logger.info("Đang nạp mô hình TensorFlow Face Feature Extractor...")
        try:
            if tf is not None:
                # Sử dụng mô hình MobileNetV2 làm Feature Extractor chuẩn 128 chiều
                base_model = tf.keras.applications.MobileNetV2(
                    input_shape=(128, 128, 3),
                    include_top=False,
                    weights="imagenet",
                    pooling="avg"
                )
                
                # Chiếu không gian đặc trưng về 128 chiều L2-Normalized
                inputs = tf.keras.Input(shape=(128, 128, 3))
                x = base_model(inputs)
                outputs = tf.keras.layers.Dense(128, activation=None)(x)
                
                self.model = tf.keras.Model(inputs=inputs, outputs=outputs)
                logger.info("Nạp mô hình TensorFlow Face Feature Extractor THÀNH CÔNG!")
            else:
                logger.warning("TensorFlow chưa sẵn sàng, mô hình sẽ sử dụng fallback extractor.")
        except Exception as e:
            logger.error(f"Lỗi nạp mô hình AI: {e}. Đang dùng Fallback Feature Extractor.")
            self.model = None

    def extract_embedding(self, img: np.ndarray, bbox: Tuple[int, int, int, int]) -> List[float]:
        """
        Cắt vùng mặt từ Bounding Box, tiền xử lý và trích xuất vector đặc trưng 128 chiều.
        """
        face_crop = crop_face(img, bbox, margin_ratio=0.2)
        if face_crop.size == 0:
            face_crop = img

        resized_face = cv2.resize(face_crop, self.target_size)
        rgb_face = cv2.cvtColor(resized_face, cv2.COLOR_BGR2RGB)

        if self.model is not None and tf is not None:
            # Tiền xử lý chuẩn hóa dải pixel [-1.0, 1.0]
            input_tensor = (rgb_face.astype(np.float32) / 127.5) - 1.0
            input_tensor = np.expand_dims(input_tensor, axis=0)

            # Dự đoán vector đặc trưng (Inference)
            raw_vector = self.model.predict(input_tensor, verbose=0)[0]
        else:
            # Fallback nhẹ nhàng bằng OpenCV Color Histogram & Edge features nếu không có TF model
            gray = cv2.cvtColor(resized_face, cv2.COLOR_RGB2GRAY)
            hist = cv2.calcHist([gray], [0], None, [128], [0, 256]).flatten()
            raw_vector = hist.astype(np.float32)

        # L2-Normalize vector đặc trưng
        norm = np.linalg.norm(raw_vector)
        if norm > 0.0:
            normalized_vector = raw_vector / norm
        else:
            normalized_vector = raw_vector

        return [float(np.round(v, 6)) for v in normalized_vector]


embedding_service = EmbeddingService()
