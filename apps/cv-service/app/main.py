"""Điểm khởi động cv-service.

Service này chỉ phục vụ backend trong mạng nội bộ: frontend không gọi trực tiếp,
nên CORS mặc định tắt (chỉ bật khi CORS_ORIGINS được khai báo tường minh) và mọi
endpoint xử lý ảnh yêu cầu header X-CV-API-Key.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import enrollment, health, recognition, validation
from app.core.config import settings
from app.core.constants import STATUS_MESSAGES, CvStatus
from app.core.logging import logger, setup_logging
from app.core.models import model_registry
from app.schemas.common import ApiResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info(f"Khởi động {settings.APP_NAME} v{settings.APP_VERSION}...")

    if not settings.API_KEY:
        logger.warning(
            "API_KEY chưa được cấu hình - mọi endpoint đang mở cho bất kỳ ai truy cập được "
            "cổng này. Chỉ dùng ở môi trường phát triển cục bộ."
        )

    model_registry.load()
    if not model_registry.is_ready:
        logger.error("Service khởi động ở trạng thái DEGRADED: model chưa sẵn sàng.")

    yield

    logger.info(f"Tắt dịch vụ {settings.APP_NAME}...")


app = FastAPI(
    title="CV Service",
    description="Computer Vision & Face Recognition Service for eManagement",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# Chỉ bật CORS khi có origin cụ thể; không dùng "*" kèm allow_credentials (tổ hợp
# này bị trình duyệt từ chối và cũng không cần thiết cho giao tiếp server-to-server).
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["POST", "GET"],
        allow_headers=["Content-Type", "X-CV-API-Key", "Authorization"],
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ghi chi tiết lỗi vào log, chỉ trả về thông điệp chung cho client."""
    logger.error(f"Lỗi hệ thống chưa được xử lý tại {request.url.path}: {exc}", exc_info=True)
    response = ApiResponse.fail(
        status=CvStatus.INTERNAL_ERROR,
        message=STATUS_MESSAGES[CvStatus.INTERNAL_ERROR],
    )
    return JSONResponse(status_code=500, content=response.model_dump(mode="json"))


app.include_router(health.router, prefix="/api/v1")
app.include_router(validation.router, prefix="/api/v1")
app.include_router(enrollment.router, prefix="/api/v1")
app.include_router(recognition.router, prefix="/api/v1")
