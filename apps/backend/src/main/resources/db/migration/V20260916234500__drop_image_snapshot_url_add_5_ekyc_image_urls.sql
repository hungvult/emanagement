-- ====================================================================
-- Migration: Xóa cột image_snapshot_url và bổ sung 5 trường con lưu URL ảnh eKYC
-- Timestamp: V20260916234500
-- ====================================================================

ALTER TABLE face_data
    DROP COLUMN IF EXISTS image_snapshot_url,
    ADD COLUMN IF NOT EXISTS front_image_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS blink_image_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS left_image_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS right_image_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS up_image_url VARCHAR(500);
