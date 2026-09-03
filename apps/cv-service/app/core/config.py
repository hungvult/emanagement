from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "cv-service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Bảo vệ API: backend phải gửi header X-CV-API-Key trùng giá trị này.
    # Để trống = tắt xác thực (chỉ dùng khi chạy local).
    API_KEY: str = ""

    # Danh sách origin được phép gọi trực tiếp (CORS)
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    SPRING_BOOT_URL: str = "http://localhost:2504"

    # Đường dẫn model ONNX (OpenCV Zoo). Tải bằng: python scripts/download_models.py
    DETECTOR_MODEL_PATH: str = "weights/yunet.onnx"
    RECOGNIZER_MODEL_PATH: str = "weights/arcface.onnx"

    # YuNet detector
    DETECTOR_SCORE_THRESHOLD: float = 0.8
    DETECTOR_NMS_THRESHOLD: float = 0.3
    DETECTOR_TOP_K: int = 500

    # Recognition & Matching. SFace dùng cosine similarity, ngưỡng chuẩn của
    # OpenCV Zoo là 0.363; ta đặt cao hơn một chút để giảm false accept.
    EMBEDDING_DIMENSION: int = 128
    FACE_MATCH_THRESHOLD: float = 0.40
    FACE_AMBIGUITY_MARGIN: float = 0.05

    # Face Validation
    MIN_FACE_SIZE: int = 80
    MAX_YAW: float = 30.0
    MAX_PITCH: float = 25.0
    MAX_ROLL: float = 25.0
    MIN_QUALITY_SCORE: float = 0.15

    # Image Quality
    BLUR_THRESHOLD: float = 15.0
    BRIGHTNESS_MIN: float = 40.0
    BRIGHTNESS_MAX: float = 225.0

    # Vùng quét hợp lệ: tâm khuôn mặt phải nằm trong vùng giữa khung hình,
    # cách mỗi cạnh CENTER_MARGIN_RATIO * chiều tương ứng.
    CENTER_MARGIN_RATIO: float = 0.2

    # Liveness (passive, heuristic - xem docstring liveness_service)
    LIVENESS_THRESHOLD: float = 0.55
    LIVENESS_ENABLED: bool = True

    # Enrollment
    MIN_ENROLL_IMAGES: int = 1
    MAX_ENROLL_IMAGES: int = 10

    # Giới hạn kích thước ảnh base64 nhận vào (bytes sau khi giải mã)
    MAX_IMAGE_BYTES: int = 8 * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
