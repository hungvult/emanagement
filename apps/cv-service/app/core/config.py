from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "cv-service"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Recognition & Matching Thresholds
    FACE_MATCH_THRESHOLD: float = 0.85
    FACE_AMBIGUITY_MARGIN: float = 0.05

    # Face Validation Thresholds
    MIN_FACE_SIZE: int = 160
    MAX_YAW: float = 15.0
    MAX_PITCH: float = 10.0
    MAX_ROLL: float = 10.0
    MIN_QUALITY_SCORE: float = 0.75

    # Image Quality Thresholds
    BLUR_THRESHOLD: float = 100.0
    BRIGHTNESS_MIN: float = 40.0
    BRIGHTNESS_MAX: float = 220.0

    # Stability & Liveness Thresholds
    MIN_STABLE_FRAMES: int = 5
    LIVENESS_THRESHOLD: float = 0.80

    # Model Settings
    EMBEDDING_DIMENSION: int = 128
    MODEL_PATH: str = "app/models/face_recognition/facenet.h5"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
