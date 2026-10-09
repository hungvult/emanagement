-- Migration: Bổ sung cột checkout_snapshot_url vào bảng attendance_records để lưu ảnh chụp lúc ra ca
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS checkout_snapshot_url TEXT;
