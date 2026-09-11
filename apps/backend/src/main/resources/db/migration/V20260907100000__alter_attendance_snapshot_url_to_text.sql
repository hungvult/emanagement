-- ====================================================================
-- Migration: Chuyển kiểu dữ liệu snapshot_url sang TEXT để lưu chuỗi Base64
-- Timestamp: V20260907100000
-- ====================================================================

ALTER TABLE attendance_records ALTER COLUMN snapshot_url TYPE TEXT;
