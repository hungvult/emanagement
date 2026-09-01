import logging
import sys
from typing import Any


def setup_logging() -> None:
    log_format = (
        "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
    )
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[logging.StreamHandler(sys.stdout)]
    )


logger = logging.getLogger("cv-service")


def log_inference_metrics(
    request_id: str,
    endpoint: str,
    status: str,
    processing_time_ms: float,
    face_count: int = 0,
    additional_info: dict[str, Any] | None = None
) -> None:
    """
    Log inference metrics without leaking raw image data or embeddings.
    """
    msg = (
        f"request_id={request_id} | endpoint={endpoint} | status={status} | "
        f"face_count={face_count} | processing_time_ms={processing_time_ms:.2f}ms"
    )
    if additional_info:
        info_str = " | ".join(f"{k}={v}" for k, v in additional_info.items())
        msg += f" | {info_str}"
    logger.info(msg)
