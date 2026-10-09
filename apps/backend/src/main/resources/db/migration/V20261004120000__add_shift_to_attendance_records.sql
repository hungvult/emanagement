-- Thêm liên kết ca làm việc vào bảng attendance_records
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS shift_id BIGINT REFERENCES shifts(id) ON DELETE SET NULL;

-- Điền dữ liệu ca cho các bản ghi chấm công dựa trên lịch phân ca đã có
UPDATE attendance_records a
SET shift_id = es.shift_id
FROM employee_shifts es
WHERE es.user_id = a.user_id
  AND es.assigned_date = DATE(a.check_in_time)
  AND a.shift_id IS NULL;

-- Điền ca mặc định SHIFT-001 cho các bản ghi chưa có ca
UPDATE attendance_records
SET shift_id = (SELECT id FROM shifts WHERE shift_code = 'SHIFT-001' LIMIT 1)
WHERE shift_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_records_shift_id ON attendance_records(shift_id);
