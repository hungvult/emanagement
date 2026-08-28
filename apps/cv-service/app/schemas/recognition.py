from typing import List, Optional
from pydantic import BaseModel, Field


class CandidateDto(BaseModel):
    userId: int = Field(..., description="ID nhân viên")
    embedding: List[float] = Field(..., description="Vector đặc trưng khuôn mặt lưu trong hệ thống")


class RecognizeRequest(BaseModel):
    imageFrameBase64: str = Field(..., description="Chuỗi Base64 của khung hình camera chấm công")
    candidates: List[CandidateDto] = Field(..., description="Danh sách vector đại diện của các nhân viên có ca làm việc")


class RecognizeResponse(BaseModel):
    matched: bool = Field(..., description="Khớp dữ liệu nhân viên thành công hay không")
    matchedUserId: Optional[int] = Field(None, description="ID nhân viên được công nhận nếu khớp")
    similarityScore: float = Field(..., description="Điểm tương đồng Cosine giữa ảnh camera và ứng viên")
    status: str = Field(..., description="Mã CvStatus kết quả xử lý")
