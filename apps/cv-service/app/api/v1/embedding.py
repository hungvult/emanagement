"""Endpoint trích xuất vector khuôn mặt phục vụ Bulk Import & Testing.

Sử dụng FaceExtractionService đã đóng gói, controller mỏng (Thin Controller)
chỉ đảm nhiệm giải mã HTTP Base64 và trả về chuẩn ApiResponse.
"""

import time
from fastapi import APIRouter, Depends

from app.core.constants import CvStatus
from app.core.logging import log_inference_metrics
from app.core.security import require_api_key
from app.schemas.common import ApiResponse
from app.schemas.embedding import ExtractEmbeddingRequest, ExtractEmbeddingResponse
from app.services.face_extraction_service import face_extraction_service
from app.utils.image_utils import InvalidImageError, base64_to_cv2

router = APIRouter(prefix="/cv", tags=["Embedding"], dependencies=[Depends(require_api_key)])


@router.post("/extract-embedding", response_model=ApiResponse[ExtractEmbeddingResponse])
def extract_embedding(request: ExtractEmbeddingRequest) -> ApiResponse[ExtractEmbeddingResponse]:
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"

    try:
        img = base64_to_cv2(request.image)
    except InvalidImageError as exc:
        proc_time = (time.time() - start_time) * 1000
        log_inference_metrics(request_id, "/extract-embedding", CvStatus.INVALID_IMAGE.value, proc_time)
        return ApiResponse.fail(
            status=CvStatus.INVALID_IMAGE,
            message=f"Định dạng ảnh không hợp lệ: {str(exc)}",
            data=ExtractEmbeddingResponse(
                status=CvStatus.INVALID_IMAGE.value,
                message=str(exc),
            ),
        )

    # Thực hiện pipeline kiểm định chất lượng và trích xuất vector SFace
    result = face_extraction_service.extract_from_image(img, require_lighting=True, check_blur=True)

    proc_time = (time.time() - start_time) * 1000
    log_inference_metrics(
        request_id,
        "/extract-embedding",
        result.status.value,
        proc_time,
        face_count=result.face_count,
    )

    response_data = ExtractEmbeddingResponse(
        status=result.status.value,
        message=result.message,
        embedding=result.embedding,
        embeddingDimension=result.embedding_dimension,
        qualityScore=result.quality_score,
        faceCount=result.face_count,
        details=result.details,
    )

    if not result.success:
        return ApiResponse.fail(
            status=result.status,
            message=result.message,
            data=response_data,
        )

    return ApiResponse.ok(
        status=CvStatus.VALID,
        message=result.message,
        data=response_data,
    )
