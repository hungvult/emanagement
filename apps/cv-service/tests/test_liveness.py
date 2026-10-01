"""Kiểm tra mô hình phát hiện giả mạo (Anti-Spoofing / Liveness) MiniFASNetV2."""

import cv2
import pytest
from app.core.constants import CvStatus
from app.services.face_detector import face_detector
from app.services.liveness_service import liveness_detector

pytestmark = pytest.mark.usefixtures("registry")


def test_liveness_accepts_real_face():
    img = cv2.imread("apps/cv-service/tests/assets/image_T1.jpg")
    assert img is not None, "Thiếu ảnh test image_T1.jpg"
    status, faces = face_detector.detect_faces(img)
    assert status == CvStatus.VALID
    
    liv_status, is_real, score, details = liveness_detector.check_liveness(img, faces[0].bbox)
    assert liv_status == CvStatus.VALID
    assert is_real is True
    assert score >= 0.80
    assert details["label_text"] == "Real Face"


def test_liveness_rejects_screen_spoof():
    img = cv2.imread("apps/cv-service/tests/assets/image_F1.jpg")
    assert img is not None, "Thiếu ảnh test image_F1.jpg"
    status, faces = face_detector.detect_faces(img)
    assert status == CvStatus.VALID
    
    liv_status, is_real, score, details = liveness_detector.check_liveness(img, faces[0].bbox)
    assert liv_status == CvStatus.SPOOF_DETECTED
    assert is_real is False
    assert details["label_text"] == "Screen Photo"


def test_liveness_rejects_paper_spoof():
    img = cv2.imread("apps/cv-service/tests/assets/image_F2.jpg")
    assert img is not None, "Thiếu ảnh test image_F2.jpg"
    status, faces = face_detector.detect_faces(img)
    assert status == CvStatus.VALID
    
    liv_status, is_real, score, details = liveness_detector.check_liveness(img, faces[0].bbox)
    assert liv_status == CvStatus.SPOOF_DETECTED
    assert is_real is False
