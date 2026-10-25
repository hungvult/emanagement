-- Chuẩn hóa số điện thoại tài khoản Admin mặc định theo định dạng di động Việt Nam (10 số, đầu 09)
-- Giải phóng số điện thoại 0912345678 nếu tài khoản khác đang chiếm giữ để tránh vi phạm ràng buộc unique
UPDATE users
SET phone = NULL
WHERE phone = '0912345678'
  AND email <> 'admin@emanagement.com';

UPDATE users
SET phone = '0912345678',
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'admin@emanagement.com'
  AND (phone = '0123456789' OR phone IS NULL);
