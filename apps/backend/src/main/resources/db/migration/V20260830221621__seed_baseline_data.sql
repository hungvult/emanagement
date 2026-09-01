-- ====================================================================
-- Migration: Nạp dữ liệu mồi ban đầu
-- Timestamp: V20260830221621
-- Mô tả: Khởi tạo dữ liệu mẫu cho Roles, Tài khoản Admin/User, và Ca làm việc mặc định
-- Ghi chú: Không khởi tạo bảng 'kiosks' tại đây do device token cần được sinh ngẫu nhiên qua JWT ở runtime
-- ====================================================================

-- 1. Roles
INSERT INTO roles (name, description)
VALUES
    ('ROLE_ADMIN', 'Quản lý'),
    ('ROLE_USER', 'Nhân viên')
ON CONFLICT (name) DO NOTHING;

-- 2. Admin User (Password: admin123)
INSERT INTO users (employee_code, full_name, email, phone, password_hash, status)
VALUES (
    'EMP260001',
    'Ngô Văn Dũng Quản Lý',
    'admin@emanagement.com',
    '0123456789',
    '$2b$10$vlb82mN/StyRILG3D.jhsugbUGbU7LpzT16Ul2EhestApoP5Sp5Ne',
    'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'admin@emanagement.com' AND r.name = 'ROLE_ADMIN'
ON CONFLICT DO NOTHING;

-- 3. Employee User (Password: nhanvien123)
INSERT INTO users (employee_code, full_name, email, phone, password_hash, status)
VALUES (
    'EMP260002',
    'Phạm Danh Phố Nhân Viên',
    'nhanvien@emanagement.com',
    '0987654321',
    '$2b$10$xXc.jTYDMgh2CDnA5L/1DusZ79POwNPweI.oPeCVGOPI8Z5xlp3eO',
    'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'nhanvien@emanagement.com' AND r.name = 'ROLE_USER'
ON CONFLICT DO NOTHING;

-- 4. Default Shift
INSERT INTO shifts (shift_code, name, start_time, end_time, grace_peroid_minutes)
VALUES ('SHIFT-001', 'Ca hành chính', '08:00:00', '17:00:00', 15)
ON CONFLICT (shift_code) DO NOTHING;
