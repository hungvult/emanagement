-- ====================================================================
-- Migration: Chuyển kiểu dữ liệu image_snapshot_url sang TEXT để lưu danh sách URL ảnh eKYC
-- Timestamp: V20260915200800
-- ====================================================================

ALTER TABLE face_data ALTER COLUMN image_snapshot_url TYPE TEXT;
