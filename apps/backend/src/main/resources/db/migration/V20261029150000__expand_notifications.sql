ALTER TABLE notifications ADD COLUMN target_url VARCHAR(500);
ALTER TABLE notifications ADD COLUMN deduplication_key VARCHAR(200);
ALTER TABLE notifications ADD COLUMN expires_at TIMESTAMP;
ALTER TABLE notifications ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX uk_notifications_deduplication_key ON notifications(deduplication_key);
CREATE INDEX idx_notifications_user_visible ON notifications(user_id, is_deleted, created_at DESC);
