from fastapi import APIRouter
from pydantic import BaseModel
from app.core.config import settings
from app.core.constants import CvStatus
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/cv", tags=["Health"])


class HealthStatusDto(BaseModel):
    status: str
    service: str
    version: str
    models: dict[str, str]


@router.get("/health", response_model=ApiResponse[HealthStatusDto])
def health_check() -> ApiResponse[HealthStatusDto]:
    data = HealthStatusDto(
        status="UP",
        service=settings.APP_NAME,
        version=settings.APP_VERSION,
        models={
            "face_recognition": "READY",
            "liveness": "READY"
        }
    )
    return ApiResponse.ok(status=CvStatus.VALID, data=data, message="CV Service đang hoạt động bình thường")
