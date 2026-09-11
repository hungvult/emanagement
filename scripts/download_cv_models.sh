#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CV_SCRIPT="${PROJECT_ROOT}/apps/cv-service/scripts/download_models.py"

echo "=== Tải mô hình AI cho CV Service ==="

if command -v python3 >/dev/null 2>&1; then
    echo "[INFO] Sử dụng Python3 trên máy host..."
    python3 "${CV_SCRIPT}"
else
    echo "[INFO] Không tìm thấy Python3 trên host. Chạy qua Docker container..."
    docker compose run --rm cv-service python scripts/download_models.py
fi

echo "[INFO] Hoàn tất kiểm tra và tải mô hình."
