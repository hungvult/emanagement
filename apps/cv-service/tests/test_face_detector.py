"""Detector status contract, independent of model inference."""

from types import SimpleNamespace

import numpy as np
import pytest

from app.core.constants import CvStatus
from app.services import face_detector as detector_module


@pytest.mark.parametrize(
    "sizes, expected",
    [([], CvStatus.NO_FACE), ([80], CvStatus.VALID), ([80, 120], CvStatus.MULTIPLE_FACES)],
)
def test_detector_keeps_all_faces_sorted_by_area(monkeypatch, sizes, expected):
    rows = np.array([[10, 10, size, size, *([20] * 10), 0.95] for size in sizes])
    monkeypatch.setattr(
        detector_module,
        "model_registry",
        SimpleNamespace(detector_ready=True, detect=lambda img: rows),
    )
    status, faces = detector_module.face_detector.detect_faces(np.zeros((256, 256, 3), dtype=np.uint8))
    assert status == expected
    assert len(faces) == len(sizes)
    assert [face.area for face in faces] == sorted([size * size for size in sizes], reverse=True)
