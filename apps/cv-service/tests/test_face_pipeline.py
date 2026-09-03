"""Kiểm tra detector và embedding trên ảnh thật.

Điểm quan trọng nhất: cùng một người dù đổi độ sáng / bị làm mờ vẫn phải cho điểm
cao hơn ngưỡng rất nhiều, còn hai người khác nhau phải thấp hơn ngưỡng rõ rệt.
Đây chính là tính chất mà phiên bản embedding cũ (histogram) không đạt được.
"""

import cv2
import numpy as np
import pytest

from app.core.config import settings
from app.core.constants import CvStatus
from app.services.embedding_service import average_embeddings, embedding_service
from app.services.face_detector import face_detector
from app.services.face_pose import face_pose_estimator
from app.services.face_quality import face_quality_assessor
from app.utils.similarity import cosine_similarity

pytestmark = pytest.mark.usefixtures("registry")


def _single_face(img: np.ndarray):
    status, faces = face_detector.detect_faces(img)
    assert status == CvStatus.VALID, f"Không phát hiện đúng 1 mặt: {status}"
    return faces[0]


def test_detects_no_face_on_noise(no_face):
    status, faces = face_detector.detect_faces(no_face)
    assert status == CvStatus.NO_FACE
    assert faces == []


def test_detects_multiple_faces(face_a):
    """Ghép 2 ảnh cạnh nhau -> phải báo MULTIPLE_FACES chứ không lặng lẽ lấy mặt to nhất."""
    side_by_side = np.hstack([face_a, face_a])
    status, faces = face_detector.detect_faces(side_by_side)
    assert status == CvStatus.MULTIPLE_FACES
    assert len(faces) >= 2


def test_detected_bbox_inside_frame(face_a):
    face = _single_face(face_a)
    x, y, w, h = face.bbox
    frame_h, frame_w = face_a.shape[:2]
    assert 0 <= x and 0 <= y and w > 0 and h > 0
    assert x + w <= frame_w and y + h <= frame_h


def test_embedding_shape_and_normalization(face_a):
    vector = embedding_service.extract_embedding(face_a, _single_face(face_a))
    assert len(vector) == settings.EMBEDDING_DIMENSION
    assert float(np.linalg.norm(vector)) == pytest.approx(1.0, abs=1e-3)


def test_embedding_is_deterministic(face_a):
    face = _single_face(face_a)
    first = embedding_service.extract_embedding(face_a, face)
    second = embedding_service.extract_embedding(face_a, face)
    assert first == second


def test_same_person_survives_brightness_and_blur(face_a):
    reference = embedding_service.extract_embedding(face_a, _single_face(face_a))

    darker = cv2.convertScaleAbs(face_a, alpha=1.0, beta=-35)
    blurred = cv2.GaussianBlur(face_a, (5, 5), 0)

    dark_score = cosine_similarity(
        reference, embedding_service.extract_embedding(darker, _single_face(darker))
    )
    blur_score = cosine_similarity(
        reference, embedding_service.extract_embedding(blurred, _single_face(blurred))
    )

    assert dark_score > settings.FACE_MATCH_THRESHOLD, dark_score
    assert blur_score > settings.FACE_MATCH_THRESHOLD, blur_score


def test_different_people_score_below_threshold(face_a, face_b):
    vec_a = embedding_service.extract_embedding(face_a, _single_face(face_a))
    vec_b = embedding_service.extract_embedding(face_b, _single_face(face_b))
    score = cosine_similarity(vec_a, vec_b)
    assert score < settings.FACE_MATCH_THRESHOLD, score


def test_average_embedding_is_unit_length(face_a):
    face = _single_face(face_a)
    vectors = [
        embedding_service.extract_embedding(face_a, face),
        embedding_service.extract_embedding(
            cv2.GaussianBlur(face_a, (3, 3), 0), _single_face(cv2.GaussianBlur(face_a, (3, 3), 0))
        ),
    ]
    merged = average_embeddings(vectors)
    assert len(merged) == settings.EMBEDDING_DIMENSION
    assert float(np.linalg.norm(merged)) == pytest.approx(1.0, abs=1e-3)


def test_quality_rejects_tiny_face(face_a):
    status, score, details = face_quality_assessor.evaluate_quality(face_a, (10, 10, 20, 20))
    assert status == CvStatus.FACE_TOO_SMALL
    assert score == 0.0
    assert details["face_size_valid"] is False


def test_quality_accepts_real_face(face_a):
    status, score, _ = face_quality_assessor.evaluate_quality(face_a, _single_face(face_a).bbox)
    assert status == CvStatus.VALID
    assert score >= settings.MIN_QUALITY_SCORE


def test_pose_valid_on_frontal_face(face_a):
    status, is_valid, data = face_pose_estimator.estimate_pose(_single_face(face_a))
    assert status == CvStatus.VALID
    assert is_valid is True
    assert abs(data["yaw"]) <= settings.MAX_YAW


def test_pose_fails_closed_on_degenerate_landmarks(face_a):
    """Landmark suy biến phải bị từ chối, không được coi là tư thế hợp lệ."""
    face = _single_face(face_a)
    broken = type(face)(
        bbox=face.bbox,
        right_eye=(100.0, 100.0),
        left_eye=(100.0, 100.0),
        nose=face.nose,
        mouth_right=face.mouth_right,
        mouth_left=face.mouth_left,
        score=face.score,
        raw=face.raw,
    )
    status, is_valid, data = face_pose_estimator.estimate_pose(broken)
    assert status == CvStatus.FACE_POSE_INVALID
    assert is_valid is False
    assert data["landmarks_degenerate"] is True
