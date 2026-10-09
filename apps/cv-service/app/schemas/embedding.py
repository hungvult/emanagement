"""Schemas cho API trích xuất vector khuôn mặt phục vụ Bulk Import & Testing."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.core.constants import CvStatus


class ExtractEmbeddingRequest(BaseModel):
    image: str = Field(..., description="Ảnh chân dung dạng chuỗi Base64 (Data URI hoặc raw base64)")


class ExtractEmbeddingResponse(BaseModel):
    status: str = Field(..., description="Mã trạng thái CvStatus (VALID, IMAGE_TOO_DARK, NO_FACE, ...)")
    message: str = Field(..., description="Thông điệp chi tiết")
    embedding: Optional[List[float]] = Field(None, description="Vector đặc trưng 128D chuẩn hóa L2")
    embeddingDimension: int = Field(0, description="Số chiều của vector (thường là 128)")
    qualityScore: float = Field(0.0, description="Điểm chất lượng ảnh")
    faceCount: int = Field(0, description="Số lượng khuôn mặt phát hiện trong ảnh")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Chi tiết các chỉ số đo lường")
