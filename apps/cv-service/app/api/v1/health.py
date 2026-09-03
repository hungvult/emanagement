"""Health check báo cáo đúng trạng thái nạp model thay vì hard-code READY.

Endpoint này không yêu cầu API key để hạ tầng (Docker HEALTHCHECK, load balancer)
kiểm tra được, nên nó chỉ trả về trạng thái, không trả về đường dẫn model.
"""

from fastapi import APIRouter, Response, status as http_status
from pydantic import BaseModel

from app.core.config import settings
from app.core.constants import CvStatus
from app.core.models import model_registry
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/cv", tags=["Health"])


class HealthStatusDto(BaseModel):
    status: str
    service: str
    version: str
    models: dict[str, str]


def _state(ready: bool) -> str:
    return "READY" if ready else "NOT_READY"


@router.get("/health", response_model=ApiResponse[HealthStatusDto])
def health_check(response: Response) -> ApiResponse[HealthStatusDto]:
    ready = model_registry.is_ready
    data = HealthStatusDto(
        status="UP" if ready else "DEGRADED",
        service=settings.APP_NAME,
        version=settings.APP_VERSION,
        models={
            "face_detector": _state(model_registry.detector_ready),
            "face_recognizer": _state(model_registry.recognizer_ready),
            "liveness": "READY" if settings.LIVENESS_ENABLED else "DISABLED",
        },
    )

    if ready:
        return ApiResponse.ok(
            status=CvStatus.VALID, data=data, message="CV Service đang hoạt động bình thường."
        )

    response.status_code = http_status.HTTP_503_SERVICE_UNAVAILABLE
    return ApiResponse.fail(
        status=CvStatus.MODEL_NOT_READY,
        data=data,
        message=model_registry.load_error or "Mô hình AI chưa được nạp.",
    )
