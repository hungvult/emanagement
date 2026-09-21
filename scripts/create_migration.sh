#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Lỗi: Thiếu tên mô tả migration."
    echo "Cách dùng: $0 <ten_mo_ta>"
    echo "Ví dụ: $0 add_user_avatar"
    exit 1
fi

RAW_NAME="$1"
CLEAN_NAME=$(echo "${RAW_NAME}" | tr ' -' '__' | tr '[:upper:]' '[:lower:]')

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATION_DIR="${PROJECT_ROOT}/apps/backend/src/main/resources/db/migration"

if [ ! -d "${MIGRATION_DIR}" ]; then
    echo "Lỗi: Không tìm thấy thư mục migration tại ${MIGRATION_DIR}"
    exit 1
fi

TIMESTAMP=$(date -u +%Y%m%d%H%M%S)
FILE_NAME="V${TIMESTAMP}__${CLEAN_NAME}.sql"
FILE_PATH="${MIGRATION_DIR}/${FILE_NAME}"

touch "${FILE_PATH}"
echo "Đã tạo: ${FILE_PATH}"
