from typing import Dict, Any
from pydantic import BaseModel, Field


class ValidateFrameRequest(BaseModel):
    image: str = Field(..., description="Chuỗi Base64 của camera frame cần kiểm tra")


class PoseDto(BaseModel):
    yaw: float = Field(..., description="Góc xoay trái/phải (độ)")
    pitch: float = Field(..., description="Góc gật/ngửa (độ)")
    roll: float = Field(..., description="Góc nghiêng vai (độ)")
    is_valid: bool = Field(..., description="Tư thế mặt có hợp lệ không")


class ValidateFrameResponse(BaseModel):
    face_count: int = Field(..., description="Số lượng khuôn mặt phát hiện trong khung hình")
    quality_score: float = Field(..., description="Điểm chất lượng hình ảnh (0.0 đến 1.0)")
    position_valid: bool = Field(..., description="Khuôn mặt có nằm trong vùng Scan Zone không")
    pose: PoseDto = Field(..., description="Góc nghiêng của đầu (Yaw, Pitch, Roll)")
    details: Dict[str, Any] = Field(default_factory=dict, description="Chi tiết các chỉ số đo lường")
