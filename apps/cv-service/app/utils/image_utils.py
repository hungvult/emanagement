import base64
from typing import Tuple
import cv2
import numpy as np


def base64_to_cv2(base64_str: str) -> np.ndarray:
    """
    Giải mã chuỗi Base64 (có hoặc không có prefix data:image/jpeg;base64,)
    thành ma trận ảnh BGR của OpenCV (np.ndarray).
    """
    if not base64_str or not base64_str.strip():
        raise ValueError("Chuỗi Base64 ảnh không được để trống")

    clean_str = base64_str.strip()
    if "," in clean_str:
        clean_str = clean_str.split(",")[1]

    # Loại bỏ ký tự không hợp lệ
    clean_str = "".join(clean_str.split())

    image_bytes = base64.b64decode(clean_str)
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Không thể giải mã định dạng hình ảnh từ chuỗi Base64")

    return img


def cv2_to_rgb(img: np.ndarray) -> np.ndarray:
    """
    Chuyển đổi ma trận ảnh từ không gian màu BGR (mặc định OpenCV) sang RGB.
    """
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def crop_face(img: np.ndarray, bbox: Tuple[int, int, int, int], margin_ratio: float = 0.2) -> np.ndarray:
    """
    Cắt vùng khuôn mặt từ ma trận ảnh theo Bounding Box (x, y, w, h) có thêm lề (margin).
    """
    x, y, w, h = bbox
    img_h, img_w = img.shape[:2]

    margin_w = int(w * margin_ratio)
    margin_h = int(h * margin_ratio)

    x1 = max(0, x - margin_w)
    y1 = max(0, y - margin_h)
    x2 = min(img_w, x + w + margin_w)
    y2 = min(img_h, y + h + margin_h)

    return img[y1:y2, x1:x2]
