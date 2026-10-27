# syntax=docker/dockerfile:1

# 1. Builder Stage: Install dependencies and verified models
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir --user -r requirements.txt

# Download models
# The downloader fails the build when a checksum is incorrect
COPY scripts/download_models.py ./scripts/download_models.py
RUN python scripts/download_models.py

# Copy source code
COPY app ./app

# 2. Runner Stage: Lightweight runtime with non-root user
FROM python:3.12-slim AS runner

WORKDIR /app

# Required runtime shared libraries for OpenCV/GUI components
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user
RUN groupadd -g 1001 appuser && \
    useradd -u 1001 -g appuser -s /bin/sh appuser

# Copy only runtime dependencies, application code and verified model files.
# Build tools and the model downloader stay out of the runtime image.
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local
COPY --from=builder --chown=appuser:appuser /app/app /app/app
COPY --from=builder --chown=appuser:appuser /app/weights /app/weights

ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${UVICORN_WORKERS:-2}"]
