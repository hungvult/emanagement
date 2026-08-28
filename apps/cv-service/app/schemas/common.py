from typing import Generic, TypeVar
from pydantic import BaseModel, Field
from app.core.constants import CvStatus, STATUS_MESSAGES

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool = Field(..., description="Trạng thái thành công của yêu cầu")
    status: CvStatus = Field(..., description="Mã trạng thái chuẩn từ hệ thống CV")
    message: str = Field(..., description="Thông điệp mô tả chi tiết")
    data: T | None = Field(default=None, description="Dữ liệu trả về (nếu có)")

    @classmethod
    def ok(cls, status: CvStatus = CvStatus.VALID, data: T | None = None, message: str | None = None):
        return cls(
            success=True,
            status=status,
            message=message or STATUS_MESSAGES.get(status, "Thành công"),
            data=data
        )

    @classmethod
    def fail(cls, status: CvStatus, message: str | None = None, data: T | None = None):
        return cls(
            success=False,
            status=status,
            message=message or STATUS_MESSAGES.get(status, "Thất bại"),
            data=data
        )
