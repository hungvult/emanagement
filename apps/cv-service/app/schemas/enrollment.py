from typing import List
from pydantic import BaseModel, Field


class EnrollRequest(BaseModel):
    userId: int = Field(..., description="ID nhân viên cần đăng ký khuôn mặt")
    images: List[str] = Field(..., description="Danh sách các khung hình Base64 chụp góc mặt nhân viên (1-10 ảnh)")


class EnrollResponse(BaseModel):
    userId: int = Field(..., description="ID nhân viên")
    embedding: List[float] = Field(..., description="Vector đặc trưng khuôn mặt đã tổng hợp (128 chiều)")
    qualityScore: float = Field(..., description="Điểm chất lượng trung bình của các ảnh đăng ký")
    processedFrames: int = Field(..., description="Số lượng khung hình hợp lệ đã được xử lý")
