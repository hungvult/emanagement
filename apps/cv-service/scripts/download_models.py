"""Tải model ONNX của OpenCV Zoo về thư mục weights/ và kiểm tra SHA-256.

Cách dùng:
    python scripts/download_models.py

Lưu ý: phải dùng host media.githubusercontent.com. Đường dẫn raw.githubusercontent.com
trả về file git-lfs pointer (~130 byte) thay vì model thật.
"""

import hashlib
import sys
import urllib.request
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]

# Checksum SHA-256 của model chuẩn từ OpenCV Zoo, dùng để phát hiện file tải lỗi.
MODEL_CHECKSUMS: dict[str, str] = {
    "face_detection_yunet_2023mar.onnx": "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    "face_recognition_sface_2021dec.onnx": "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
}

BASE_URL = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models"
MODELS = {
    "face_detection_yunet_2023mar.onnx": f"{BASE_URL}/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    "face_recognition_sface_2021dec.onnx": f"{BASE_URL}/face_recognition_sface/face_recognition_sface_2021dec.onnx",
}
WEIGHTS_DIR = SERVICE_ROOT / "weights"


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(filename: str, url: str) -> bool:
    target = WEIGHTS_DIR / filename
    expected = MODEL_CHECKSUMS[filename]

    if target.is_file() and sha256_of(target) == expected:
        print(f"[OK] {filename} đã có sẵn và đúng checksum.")
        return True

    print(f"[..] Đang tải {filename} ...")
    tmp = target.with_suffix(target.suffix + ".part")
    try:
        with urllib.request.urlopen(url, timeout=120) as response, tmp.open("wb") as out:
            while True:
                chunk = response.read(1024 * 256)
                if not chunk:
                    break
                out.write(chunk)
    except Exception as exc:  # noqa: BLE001
        tmp.unlink(missing_ok=True)
        print(f"[LỖI] Không tải được {filename}: {exc}")
        return False

    actual = sha256_of(tmp)
    if actual != expected:
        tmp.unlink(missing_ok=True)
        print(f"[LỖI] Checksum {filename} không khớp.\n  mong đợi: {expected}\n  thực tế : {actual}")
        return False

    tmp.replace(target)
    size_mb = target.stat().st_size / (1024 * 1024)
    print(f"[OK] {filename} ({size_mb:.1f} MB) - checksum khớp.")
    return True


def main() -> int:
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    ok = all(download(name, url) for name, url in MODELS.items())
    if ok:
        print(f"\nHoàn tất. Model nằm tại: {WEIGHTS_DIR}")
        return 0
    print("\nCó model tải thất bại. cv-service sẽ trả về MODEL_NOT_READY nếu thiếu model.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
