"""Xác thực request nội bộ giữa backend và cv-service.

cv-service không nên mở ra Internet. Ngoài việc chỉ bind trong mạng nội bộ,
mọi endpoint xử lý ảnh yêu cầu header X-CV-API-Key trùng với settings.API_KEY.
"""

import secrets

from fastapi import Header, HTTPException, status

from app.core.config import settings

API_KEY_HEADER = "X-CV-API-Key"


async def require_api_key(x_cv_api_key: str | None = Header(default=None)) -> None:
    """Dependency chặn request không có API key hợp lệ.

    Nếu settings.API_KEY để trống thì bỏ qua kiểm tra (chế độ local); cảnh báo
    tương ứng được ghi log một lần khi khởi động.
    """
    expected = settings.API_KEY
    if not expected:
        return

    if not x_cv_api_key or not secrets.compare_digest(x_cv_api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Thiếu hoặc sai {API_KEY_HEADER}",
        )
