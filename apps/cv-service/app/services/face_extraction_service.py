"""Dịch vụ trích xuất vector đặc trưng khuôn mặt chuẩn Clean Architecture.

Đóng gói trọn vẹn quy trình:
1. Phát hiện khuôn mặt (YuNet Face Detector) -> Bắt buộc đúng 1 mặt.
2. Kiểm tra chất lượng (Face Quality Assessor) -> Độ sáng (Lighting Gate), Kích thước, Độ mờ nhòe (Laplacian).
3. Trích xuất đặc trưng (SFace Recognizer) -> Căn chỉnh crop 112x112, vector 128D chuẩn hóa L2.

Tách rời logic khỏi controller giúp kiểm thử unit test độc lập và tái sử dụng cho cả
luồng nạp hàng loạt (Bulk Import) lẫn luồng eKYC Kiosk.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from app.core.constants import STATUS_MESSAGES, CvStatus
from app.core.logging import logger
from app.services.embedding_service import ModelNotReadyError, embedding_service
from app.services.face_detector import face_detector
from app.services.face_quality import face_quality_assessor


@dataclass
class FaceExtractionResult:
    status: CvStatus
    success: bool
    embedding: Optional[List[float]] = None
    embedding_dimension: int = 0
    quality_score: float = 0.0
    face_count: int = 0
    bbox: Optional[Tuple[int, int, int, int]] = None
    details: Dict[str, Any] = field(default_factory=dict)
    message: str = ""


class FaceExtractionService:
    def extract_from_image(
        self,
        img: np.ndarray,
        *,
        require_lighting: bool = True,
        check_blur: bool = True,
    ) -> FaceExtractionResult:
        """Thực hiện đầy đủ pipeline kiểm định và trích xuất vector từ ma trận ảnh numpy."""
        if not embedding_service.is_ready:
            return FaceExtractionResult(
                status=CvStatus.MODEL_NOT_READY,
                success=False,
                message=STATUS_MESSAGES.get(CvStatus.MODEL_NOT_READY, "Model chưa sẵn sàng"),
            )

        # 1. Phát hiện khuôn mặt qua YuNet
        detect_status, faces = face_detector.detect_faces(img)
        face_count = len(faces)

        if detect_status != CvStatus.VALID:
            # Nếu trong bóng tối không thấy mặt, kiểm tra độ sáng trước để báo đúng nguyên nhân
            if detect_status == CvStatus.NO_FACE and require_lighting:
                lighting_status, _, light_details = face_quality_assessor.evaluate_lighting(img)
                if lighting_status != CvStatus.VALID:
                    return FaceExtractionResult(
                        status=lighting_status,
                        success=False,
                        face_count=0,
                        details=light_details,
                        message=STATUS_MESSAGES.get(lighting_status, "Ảnh quá tối"),
                    )

            return FaceExtractionResult(
                status=detect_status,
                success=False,
                face_count=face_count,
                message=STATUS_MESSAGES.get(detect_status, "Không tìm thấy khuôn mặt hợp lệ"),
            )

        if face_count != 1:
            return FaceExtractionResult(
                status=CvStatus.MULTIPLE_FACES,
                success=False,
                face_count=face_count,
                message=STATUS_MESSAGES.get(CvStatus.MULTIPLE_FACES, "Phát hiện nhiều hơn 1 khuôn mặt"),
            )

        face = faces[0]

        # 2. Đánh giá chất lượng khuôn mặt (kích thước, độ mờ nhòe, độ sáng)
        quality_status, quality_score, quality_details = face_quality_assessor.evaluate_quality(
            img, face.bbox, require_lighting=require_lighting
        )

        if quality_status != CvStatus.VALID:
            return FaceExtractionResult(
                status=quality_status,
                success=False,
                quality_score=quality_score,
                face_count=1,
                bbox=face.bbox,
                details=quality_details,
                message=STATUS_MESSAGES.get(quality_status, "Chất lượng ảnh không đạt yêu cầu"),
            )

        # 3. Trích xuất vector đặc trưng 128D chuẩn hóa L2 qua SFace
        try:
            vector = embedding_service.extract_embedding(img, face)
        except ModelNotReadyError:
            return FaceExtractionResult(
                status=CvStatus.MODEL_NOT_READY,
                success=False,
                face_count=1,
                bbox=face.bbox,
                message=STATUS_MESSAGES.get(CvStatus.MODEL_NOT_READY, "Model chưa sẵn sàng"),
            )
        except Exception as e:
            logger.exception("Lỗi khi trích xuất vector SFace từ ảnh: %s", e)
            return FaceExtractionResult(
                status=CvStatus.INTERNAL_ERROR,
                success=False,
                face_count=1,
                bbox=face.bbox,
                message=f"Lỗi trích xuất vector: {str(e)}",
            )

        return FaceExtractionResult(
            status=CvStatus.VALID,
            success=True,
            embedding=vector,
            embedding_dimension=len(vector),
            quality_score=round(quality_score, 2),
            face_count=1,
            bbox=face.bbox,
            details=quality_details,
            message="Trích xuất vector khuôn mặt thành công",
        )


face_extraction_service = FaceExtractionService()
