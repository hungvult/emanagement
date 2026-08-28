from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.v1 import health, validation, enrollment, recognition
from app.core.config import settings
from app.core.constants import CvStatus
from app.core.logging import logger, setup_logging
from app.schemas.common import ApiResponse
from app.services.embedding_service import embedding_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup phase
    setup_logging()
    logger.info(f"Khởi động {settings.APP_NAME} v{settings.APP_VERSION}...")
    embedding_service.load_model()
    yield
    # Shutdown phase
    logger.info(f"Tắt dịch vụ {settings.APP_NAME}...")


app = FastAPI(
    title="CV Service",
    description="Computer Vision & Face Recognition Service for eManagement",
    version=settings.APP_VERSION,
    lifespan=lifespan
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Lỗi hệ thống chưa được xử lý tại {request.url.path}: {exc}", exc_info=True)
    response = ApiResponse.fail(
        status=CvStatus.INTERNAL_ERROR,
        message=f"Internal processing error: {str(exc)}"
    )
    return JSONResponse(status_code=500, content=response.model_dump())


# Đăng ký Routers API v1
app.include_router(health.router, prefix="/api/v1")
app.include_router(validation.router, prefix="/api/v1")
app.include_router(enrollment.router, prefix="/api/v1")
app.include_router(recognition.router, prefix="/api/v1")
