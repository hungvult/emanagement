-- ====================================================================
-- Migration: Nâng cấp quản lý ca & phân ca
--  1. Chống trùng lịch (UNIQUE user_id + assigned_date)
--  2. Snapshot giờ ca vào employee_shifts (sửa ca không làm đổi lịch sử)
--  3. Soft-delete cho shifts (is_active), FK không còn CASCADE
-- ====================================================================

-- 0. Dọn dữ liệu trùng (giữ bản ghi mới nhất của mỗi user/ngày) trước khi thêm UNIQUE
DELETE FROM employee_shifts a
USING employee_shifts b
WHERE a.user_id = b.user_id
  AND a.assigned_date = b.assigned_date
  AND a.id < b.id;

-- 1. shifts: trạng thái hoạt động + thời điểm cập nhật
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- NOT VALID: không kiểm tra dữ liệu cũ, chỉ áp dụng cho dữ liệu ghi mới
ALTER TABLE shifts ADD CONSTRAINT chk_shift_time_range CHECK (start_time < end_time) NOT VALID;

-- 2. employee_shifts: snapshot thông tin ca tại thời điểm phân
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS shift_name VARCHAR(100);
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS grace_period_minutes INT;

UPDATE employee_shifts es
SET shift_name = s.name,
    start_time = s.start_time,
    end_time = s.end_time,
    grace_period_minutes = COALESCE(s.grace_period_minutes, 15)
FROM shifts s
WHERE es.shift_id = s.id;

ALTER TABLE employee_shifts ALTER COLUMN shift_name SET NOT NULL;
ALTER TABLE employee_shifts ALTER COLUMN start_time SET NOT NULL;
ALTER TABLE employee_shifts ALTER COLUMN end_time SET NOT NULL;
ALTER TABLE employee_shifts ALTER COLUMN grace_period_minutes SET NOT NULL;

-- 3. Mỗi nhân viên chỉ có 1 ca / ngày
ALTER TABLE employee_shifts
    ADD CONSTRAINT uq_employee_shifts_user_date UNIQUE (user_id, assigned_date);

-- 4. Không cho xóa cứng ca đang có lịch (trước đây CASCADE sẽ xóa sạch lịch phân ca)
ALTER TABLE employee_shifts DROP CONSTRAINT IF EXISTS employee_shifts_shift_id_fkey;
ALTER TABLE employee_shifts
    ADD CONSTRAINT employee_shifts_shift_id_fkey
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE RESTRICT;

-- 5. Truy vấn lịch theo khoảng ngày cho mọi nhân viên
CREATE INDEX IF NOT EXISTS idx_employee_shifts_date ON employee_shifts(assigned_date);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_shift_date ON employee_shifts(shift_id, assigned_date);
