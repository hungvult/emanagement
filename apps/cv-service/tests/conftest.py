"""Fixture dùng chung cho test cv-service.

Ảnh mẫu là ảnh thật của OpenCV samples, không phải ảnh tổng hợp: chỉ ảnh thật mới
kiểm chứng được rằng detector và embedding hoạt động đúng.
"""

import base64
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

ASSETS = Path(__file__).parent / "assets"


def _read(name: str) -> np.ndarray:
    img = cv2.imread(str(ASSETS / name))
    if img is None:
        raise RuntimeError(f"Không đọc được ảnh mẫu: {name}")
    return img


def to_base64(img: np.ndarray, data_uri: bool = False) -> str:
    ok, buffer = cv2.imencode(".jpg", img)
    assert ok
    encoded = base64.b64encode(buffer.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}" if data_uri else encoded


@pytest.fixture(scope="session")
def face_a() -> np.ndarray:
    """Người thứ nhất, khuôn mặt lớn và chính diện."""
    return _read("face_a.jpg")


@pytest.fixture(scope="session")
def face_b() -> np.ndarray:
    """Người thứ hai; phóng to để khuôn mặt vượt ngưỡng MIN_FACE_SIZE."""
    return cv2.resize(_read("face_b.jpg"), None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)


@pytest.fixture(scope="session")
def no_face() -> np.ndarray:
    """Ảnh nhiễu ngẫu nhiên - không chứa khuôn mặt."""
    rng = np.random.default_rng(1234)
    return rng.integers(0, 255, size=(480, 640, 3), dtype=np.uint8)


@pytest.fixture(scope="session")
def registry():
    from app.core.models import model_registry

    model_registry.load()
    if not model_registry.is_ready:
        pytest.skip(f"Model chưa sẵn sàng: {model_registry.load_error}")
    return model_registry


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
