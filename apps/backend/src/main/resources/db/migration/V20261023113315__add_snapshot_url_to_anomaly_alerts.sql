-- ====================================================================
-- Migration: Bổ sung snapshot_url vào bảng anomaly_alerts
-- Lưu trữ ảnh chụp vi phạm / sự cố AI (UNKNOWN_FACE, SPOOF_DETECTED, AMBIGUOUS_MATCH)
-- ====================================================================

ALTER TABLE anomaly_alerts ADD COLUMN IF NOT EXISTS snapshot_url VARCHAR(255);

COMMENT ON COLUMN anomaly_alerts.snapshot_url IS 'Relative Object Key (snapshots/yyyy/MM/dd/fileName.ext)';
