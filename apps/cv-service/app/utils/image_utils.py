"""Tiện ích chuyển đổi và cắt ảnh dùng chung cho các bước xử lý CV."""

import base64
import binascii

import cv2
import numpy as np

from app.core.config import settings


class InvalidImageError(ValueError):
    """Dữ liệu ảnh gửi lên không đọc được hoặc vượt giới hạn kích thước."""


def base64_to_cv2(base64_str: str) -> np.ndarray:
    """Giải mã chuỗi Base64 (có/không prefix data URI) thành ma trận ảnh BGR.

    Chặn ảnh quá lớn trước khi decode để một request đơn lẻ không thể chiếm hết
    bộ nhớ của service (MAX_IMAGE_BYTES).
    """
    if not base64_str or not base64_str.strip():
        raise InvalidImageError("Chuỗi Base64 ảnh không được để trống")

    clean_str = base64_str.strip()
    if "," in clean_str:
        clean_str = clean_str.split(",", 1)[1]

    clean_str = "".join(clean_str.split())

    # 4 ký tự base64 = 3 byte; kiểm tra sớm để không cấp phát bộ nhớ vô ích.
    approx_bytes = (len(clean_str) * 3) // 4
    if approx_bytes > settings.MAX_IMAGE_BYTES:
        raise InvalidImageError(
            f"Ảnh vượt giới hạn {settings.MAX_IMAGE_BYTES // (1024 * 1024)}MB"
        )

    try:
        image_bytes = base64.b64decode(clean_str, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise InvalidImageError("Chuỗi Base64 không hợp lệ") from exc

    if len(image_bytes) > settings.MAX_IMAGE_BYTES:
        raise InvalidImageError(
            f"Ảnh vượt giới hạn {settings.MAX_IMAGE_BYTES // (1024 * 1024)}MB"
        )

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None or img.size == 0:
        raise InvalidImageError("Không thể giải mã định dạng hình ảnh từ chuỗi Base64")

    return img

