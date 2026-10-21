"""Test cấp API: /health, /validate-frame, /enroll, /recognize."""

import json
from types import SimpleNamespace

import cv2
import httpx
import numpy as np
import pytest

from app.core.config import settings
from app.core.constants import CvStatus
from tests.conftest import to_base64

pytestmark = pytest.mark.usefixtures("registry")


@pytest.fixture
def backend(monkeypatch):
    from app.api.v1 import enrollment

    state = SimpleNamespace(requests=[], status_code=200, error=None)

    def handle(request):
        state.requests.append(request)
        assert request.method == "POST"
        assert str(request.url) == f"{settings.SPRING_BOOT_URL}/api/v1/employees/ekyc-enroll"
        if state.error is not None:
            raise state.error
        return httpx.Response(state.status_code, json={"status": "SUCCESS"})

    def client(**kwargs):
        return httpx.Client(transport=httpx.MockTransport(handle), **kwargs)

    # Patch only enrollment's dependency; FastAPI TestClient keeps real httpx.
    monkeypatch.setattr(enrollment, "httpx", SimpleNamespace(Client=client))
    return state


def _variants(img: np.ndarray, count: int) -> list[np.ndarray]:
    """Sinh nhiều biến thể nhẹ của cùng một khuôn mặt, mô phỏng nhiều khung hình chụp."""
    out = [img]
    for i in range(1, count):
        beta = -8 * i if i % 2 else 8 * i
        out.append(cv2.convertScaleAbs(img, alpha=1.0, beta=beta))
    return out[:count]


def test_health_reports_model_state(client):
    response = client.get("/api/v1/cv/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "UP"
    assert body["data"]["models"]["face_detector"] == "READY"
    assert body["data"]["models"]["face_recognizer"] == "READY"
    assert body["data"]["models"]["liveness"] == "READY"


def test_validate_frame_accepts_good_face(client, face_a):
    response = client.post("/api/v1/cv/validate-frame", json={"image": to_base64(face_a)})
    body = response.json()
    assert body["status"] == CvStatus.VALID.value, body["message"]
    assert body["data"]["face_count"] == 1
    assert body["data"]["position_valid"] is True
    assert body["data"]["pose"]["is_valid"] is True


def test_validate_frame_accepts_data_uri_prefix(client, face_a):
    response = client.post(
        "/api/v1/cv/validate-frame", json={"image": to_base64(face_a, data_uri=True)}
    )
    assert response.json()["status"] == CvStatus.VALID.value


def test_validate_frame_reports_no_face(client, no_face):
    body = client.post("/api/v1/cv/validate-frame", json={"image": to_base64(no_face)}).json()
    assert body["success"] is False
    assert body["status"] == CvStatus.NO_FACE.value
    assert body["data"]["face_count"] == 0


def test_multiple_faces_are_rejected_before_enrollment_and_recognition(client, face_a, backend):
    image = to_base64(np.hstack([face_a, face_a]))
    validated = client.post("/api/v1/cv/validate-frame", json={"image": image}).json()
    assert validated["status"] == CvStatus.MULTIPLE_FACES.value
    assert validated["data"]["face_count"] >= 2

    enrolled = client.post(
        "/api/v1/cv/enroll", json={"userId": 7, "images": [image] * settings.MIN_ENROLL_IMAGES}
    ).json()
    assert enrolled["success"] is False
    assert enrolled["status"] == CvStatus.MULTIPLE_FACES.value
    assert backend.requests == []

    recognized = client.post(
        "/api/v1/cv/recognize", json={"imageFrameBase64": image, "candidates": []}
    ).json()
    assert recognized["success"] is False
    assert recognized["status"] == CvStatus.MULTIPLE_FACES.value


def test_validate_frame_rejects_garbage_image(client):
    body = client.post("/api/v1/cv/validate-frame", json={"image": "khong-phai-base64"}).json()
    assert body["success"] is False
    assert body["status"] == CvStatus.INVALID_IMAGE.value


def test_enroll_requires_minimum_images(client, face_a):
    body = client.post(
        "/api/v1/cv/enroll", json={"userId": 1, "images": [to_base64(face_a)]}
    ).json()
    assert body["success"] is False
    assert f"{settings.MIN_ENROLL_IMAGES}" in body["message"]


def test_enroll_rejects_images_without_face(client, no_face):
    """Ảnh không có mặt không được tạo ra vector rác trong cơ sở dữ liệu."""
    images = [to_base64(no_face)] * settings.MIN_ENROLL_IMAGES
    body = client.post("/api/v1/cv/enroll", json={"userId": 1, "images": images}).json()
    assert body["success"] is False
    assert body["data"]["processedFrames"] == 0
    assert all(item["status"] == CvStatus.NO_FACE.value for item in body["data"]["frameResults"])
    assert body["data"]["embedding"] == []


def test_enroll_succeeds_with_real_faces(client, face_a, backend):
    images = [to_base64(v) for v in _variants(face_a, settings.MIN_ENROLL_IMAGES)]
    body = client.post(
        "/api/v1/cv/enroll",
        json={"userId": 7, "images": images},
        headers={"Authorization": "Bearer test-token"},
    ).json()
    assert body["success"] is True, body["message"]
    data = body["data"]
    assert data["userId"] == 7
    assert data["processedFrames"] == settings.MIN_ENROLL_IMAGES
    assert data["embeddingDimension"] == settings.EMBEDDING_DIMENSION
    assert float(np.linalg.norm(data["embedding"])) == pytest.approx(1.0, abs=1e-3)
    assert len(backend.requests) == 1
    request = backend.requests[0]
    assert request.headers["Authorization"] == "Bearer test-token"
    payload = json.loads(request.content)
    assert payload["userId"] == 7
    assert payload["images"] == images
    assert payload["faceVector"] == data["embedding"]


@pytest.mark.parametrize("failure", ["http_error", "connection_error"])
def test_enroll_reports_backend_failure(client, face_a, backend, failure):
    if failure == "http_error":
        backend.status_code = 500
    else:
        backend.error = httpx.ConnectError("Backend unavailable")
    images = [to_base64(v) for v in _variants(face_a, settings.MIN_ENROLL_IMAGES)]
    body = client.post("/api/v1/cv/enroll", json={"userId": 7, "images": images}).json()
    assert len(backend.requests) == 1
    assert body["success"] is False
    assert body["status"] == CvStatus.INTERNAL_ERROR.value
    assert body["data"]["embedding"] == []


def test_recognize_matches_enrolled_person(client, face_a, backend):
    images = [to_base64(v) for v in _variants(face_a, settings.MIN_ENROLL_IMAGES)]
    enrolled = client.post("/api/v1/cv/enroll", json={"userId": 42, "images": images}).json()
    assert enrolled["success"] is True, enrolled["message"]
    assert len(backend.requests) == 1
    embedding = enrolled["data"]["embedding"]

    probe = cv2.convertScaleAbs(face_a, alpha=1.0, beta=-20)
    body = client.post(
        "/api/v1/cv/recognize",
        json={
            "imageFrameBase64": to_base64(probe),
            "candidates": [{"userId": 42, "embedding": embedding}],
        },
    ).json()

    assert body["status"] == CvStatus.MATCHED.value, body["message"]
    assert body["data"]["matchedUserId"] == 42
    assert body["data"]["similarityScore"] >= settings.FACE_MATCH_THRESHOLD


def test_recognize_rejects_other_person(client, face_a, face_b, backend):
    images = [to_base64(v) for v in _variants(face_a, settings.MIN_ENROLL_IMAGES)]
    enrolled = client.post("/api/v1/cv/enroll", json={"userId": 42, "images": images}).json()
    assert enrolled["success"] is True, enrolled["message"]
    assert len(backend.requests) == 1

    body = client.post(
        "/api/v1/cv/recognize",
        json={
            "imageFrameBase64": to_base64(face_b),
            "candidates": [{"userId": 42, "embedding": enrolled["data"]["embedding"]}],
        },
    ).json()

    assert body["success"] is False
    assert body["status"] == CvStatus.UNKNOWN_FACE.value
    assert body["data"]["matchedUserId"] is None


def test_recognize_with_empty_candidates(client, face_a):
    body = client.post(
        "/api/v1/cv/recognize",
        json={"imageFrameBase64": to_base64(face_a), "candidates": []},
    ).json()
    assert body["success"] is False
    assert body["status"] == CvStatus.UNKNOWN_FACE.value


def test_recognize_ignores_candidates_with_wrong_dimension(client, face_a):
    """Vector đăng ký từ model cũ (sai số chiều) phải bị loại, không gây lỗi 500."""
    body = client.post(
        "/api/v1/cv/recognize",
        json={
            "imageFrameBase64": to_base64(face_a),
            "candidates": [{"userId": 9, "embedding": [0.1] * 64}],
        },
    ).json()
    assert body["success"] is False
    assert body["status"] == CvStatus.UNKNOWN_FACE.value
