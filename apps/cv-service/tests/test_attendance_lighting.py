"""Chấm công phải từ chối ảnh thiếu sáng trước khi nhận diện nhân viên."""

import base64
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import cv2
import numpy as np
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.recognition import router
from app.core.config import settings
from app.core.constants import CvStatus
from app.services.face_quality import face_quality_assessor


class AttendanceLightingTests(unittest.TestCase):
    def setUp(self):
        self.threshold = patch.object(settings, "BRIGHTNESS_MIN", 130.0)
        self.threshold.start()
        self.addCleanup(self.threshold.stop)
        self.bbox = (80, 80, 160, 160)

    def test_lighting_threshold(self):
        for brightness, expected in [(0, CvStatus.IMAGE_TOO_DARK), (40, CvStatus.IMAGE_TOO_DARK),
                                     (80, CvStatus.IMAGE_TOO_DARK), (100, CvStatus.IMAGE_TOO_DARK),
                                     (120, CvStatus.IMAGE_TOO_DARK), (129, CvStatus.IMAGE_TOO_DARK),
                                     (130, CvStatus.VALID), (160, CvStatus.VALID)]:
            with self.subTest(brightness=brightness):
                img = np.full((320, 320, 3), brightness, dtype=np.uint8)
                status, score, details = face_quality_assessor.evaluate_quality(
                    img, self.bbox, require_lighting=True
                )
                self.assertEqual(status, expected)
                self.assertEqual(details["brightness"], brightness)
                self.assertEqual(score, 0.0 if expected == CvStatus.IMAGE_TOO_DARK else 1.0)

    def test_bright_background_does_not_hide_dark_face(self):
        img = np.full((320, 320, 3), 200, dtype=np.uint8)
        img[80:240, 80:240] = 80
        status, _, _ = face_quality_assessor.evaluate_quality(img, self.bbox, require_lighting=True)
        self.assertEqual(status, CvStatus.IMAGE_TOO_DARK)

    def test_dark_background_does_not_reject_well_lit_face(self):
        img = np.zeros((320, 320, 3), dtype=np.uint8)
        img[80:240, 80:240] = 160
        status, _, _ = face_quality_assessor.evaluate_quality(img, self.bbox, require_lighting=True)
        self.assertEqual(status, CvStatus.VALID)

    def test_lighting_uses_configured_threshold(self):
        img = np.full((320, 320, 3), 60, dtype=np.uint8)
        with patch.object(settings, "BRIGHTNESS_MIN", 80.0):
            status, _, _ = face_quality_assessor.evaluate_quality(img, self.bbox, require_lighting=True)
        self.assertEqual(status, CvStatus.IMAGE_TOO_DARK)

    def _recognize(self, img, detector_status):
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        ok, encoded = cv2.imencode(".png", img)
        self.assertTrue(ok)
        faces = [SimpleNamespace(bbox=self.bbox)] if detector_status == CvStatus.VALID else []
        with (
            patch.object(settings, "API_KEY", ""),
            patch("app.api.v1.recognition.face_detector.detect_faces", return_value=(detector_status, faces)),
            patch("app.api.v1.recognition.liveness_detector.check_liveness",
                  return_value=(CvStatus.VALID, True, 1.0, {})) as liveness,
            patch("app.api.v1.recognition.recognition_service.recognize_face",
                  return_value=(CvStatus.MATCHED, True, 7, 0.9, {})) as recognition,
            TestClient(app) as client,
        ):
            response = client.post("/api/v1/cv/recognize", json={
                "imageFrameBase64": base64.b64encode(encoded).decode("ascii"),
                "candidates": [{"userId": 7, "embedding": [0.1] * settings.EMBEDDING_DIMENSION}],
            })
            self.assertEqual(response.status_code, 200)
        return response.json(), liveness, recognition

    def test_recognition_rejects_dark_face_before_liveness_and_matching(self):
        img = np.full((320, 320, 3), 200, dtype=np.uint8)
        img[80:240, 80:240] = 80
        body, liveness, recognition = self._recognize(img, CvStatus.VALID)
        self.assertFalse(body["success"])
        self.assertEqual(body["status"], "IMAGE_TOO_DARK")
        self.assertIn("Chưa đủ ánh sáng", body["message"])
        self.assertFalse(body["data"]["matched"])
        self.assertIsNone(body["data"]["matchedUserId"])
        liveness.assert_not_called()
        recognition.assert_not_called()

    def test_recognition_reports_lighting_when_detector_cannot_find_face(self):
        body, liveness, recognition = self._recognize(np.zeros((320, 320, 3), dtype=np.uint8), CvStatus.NO_FACE)
        self.assertEqual(body["status"], "IMAGE_TOO_DARK")
        liveness.assert_not_called()
        recognition.assert_not_called()

    def test_well_lit_frame_without_face_keeps_no_face_response(self):
        body, _, _ = self._recognize(np.full((320, 320, 3), 160, dtype=np.uint8), CvStatus.NO_FACE)
        self.assertEqual(body["status"], "NO_FACE")

    def test_recognition_continues_when_face_is_well_lit(self):
        img = np.zeros((320, 320, 3), dtype=np.uint8)
        img[80:240, 80:240] = 160
        body, liveness, recognition = self._recognize(img, CvStatus.VALID)
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["matchedUserId"], 7)
        liveness.assert_called_once()
        recognition.assert_called_once()


if __name__ == "__main__":
    unittest.main()
