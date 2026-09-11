from typing import List, Optional

from pydantic import BaseModel, Field


class EnrollRequest(BaseModel):
    userId: int = Field(..., description="ID nhân viên cần đăng ký khuôn mặt")
    images: List[str] = Field(
        ...,
        description="Danh sách khung hình Base64 chụp các góc mặt nhân viên",
    )


class FrameResultDto(BaseModel):
    """Kết quả xử lý của từng ảnh, giúp UI chỉ ra ảnh nào bị loại và vì sao."""

    index: int = Field(..., description="Vị trí ảnh trong danh sách gửi lên (bắt đầu từ 0)")
    accepted: bool = Field(..., description="Ảnh có được dùng để tạo vector hay không")
    status: str = Field(..., description="Mã CvStatus của ảnh")
    message: str = Field(..., description="Mô tả kết quả xử lý ảnh")
    qualityScore: float = Field(0.0, description="Điểm chất lượng của ảnh")


class EnrollResponse(BaseModel):
    userId: int = Field(..., description="ID nhân viên")
    embedding: List[float] = Field(
        default_factory=list, description="Vector đặc trưng khuôn mặt đã tổng hợp"
    )
    qualityScore: float = Field(0.0, description="Điểm chất lượng trung bình các ảnh hợp lệ")
    processedFrames: int = Field(0, description="Số khung hình hợp lệ đã dùng để tạo vector")
    totalFrames: int = Field(0, description="Tổng số khung hình gửi lên")
    embeddingDimension: Optional[int] = Field(None, description="Số chiều của vector trả về")
    frameResults: List[FrameResultDto] = Field(
        default_factory=list, description="Kết quả chi tiết theo từng ảnh"
    )
