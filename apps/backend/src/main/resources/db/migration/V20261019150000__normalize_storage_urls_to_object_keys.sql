-- ====================================================================
-- Migration: Chuẩn hóa đường dẫn Object Storage từ full URL sang Object Key
-- Timestamp: V20261019150000
-- ====================================================================
--
-- [MỤC ĐÍCH & Ý NGHĨA THIẾT KẾ]
-- Tách biệt tầng lưu trữ CSDL (Persistence) khỏi hạ tầng mạng và tên bucket MinIO:
-- CSDL chỉ lưu trữ Object Key tương đối dạng `folder/yyyy/MM/dd/fileName.ext`.
-- Tầng hiển thị (Presentation) sẽ tự động ký Presigned URL động (AWS SigV4) ngắn hạn.
--
-- [TRƯỜNG HỢP ÁP DỤNG (APPLICABLE CASES)]
-- 1. Áp dụng cho các bản ghi đang lưu trữ URL ảnh nội bộ MinIO/Storage Proxy:
--    - Bắt đầu bằng: `/storage/`, `storage/`
--    - Bắt đầu bằng MinIO endpoint nội bộ: `http://minio:9000/`, `http://localhost:9000/`
--    - Chứa tên bucket hệ thống: `%/attendance-images/%`, `%/attendance-images-prod/%`
-- 2. ĐƯỜNG DẪN BẮT BUỘC PHẢI THUỘC 3 THƯ MỤC CHUẨN CỦA HỆ THỐNG:
--    - `avatars/`: Ảnh đại diện người dùng
--    - `faces/`: 5 ảnh khuôn mặt đăng ký eKYC
--    - `snapshots/`: Ảnh chụp camera tại kiosk khi check-in / check-out
--
-- [TRƯỜNG HỢP KHÔNG ÁP DỤNG - GIỮ NGUYÊN (EXCLUDED CASES)]
-- 1. Ảnh ngoại bộ (External URLs):
--    - Ảnh avatar Google OAuth (vd: `https://lh3.googleusercontent.com/...`)
--    - Ảnh từ CDN hoặc dịch vụ lưu trữ bên thứ ba khác
--    -> Tuyệt đối giữ nguyên toàn bộ URL gốc, không cắt tiền tố domain.
-- 2. Chuỗi Data URI Base64:
--    - Chuỗi inline `data:image/...` (nếu có) -> Bỏ qua, không xử lý.
-- 3. Dữ liệu đã chuẩn hóa (Idempotent):
--    - Các bản ghi đã lưu sẵn dạng Object Key tương đối (không có prefix proxy/http)
--      sẽ không thỏa mãn điều kiện WHERE, đảm bảo migration an toàn khi chạy lại.
--
-- [LƯU Ý KỸ THUẬT VỀ REGEX]
-- Sử dụng regex non-greedy `^.*?/(avatars|faces|snapshots)/` để chỉ cắt bỏ phần
-- tiền tố mạng/bucket đầu tiên, bảo toàn toàn vẹn phân cấp thư mục con thời gian
-- `yyyy/MM/dd/filename.ext` kể cả khi tên file chứa từ khóa trùng lặp.
-- ====================================================================

-- 1. Bảng users (avatar_url)
UPDATE users
SET avatar_url = regexp_replace(avatar_url, '^.*?/(avatars|faces|snapshots)/', '\1/')
WHERE (avatar_url LIKE '/storage/%'
    OR avatar_url LIKE 'storage/%'
    OR avatar_url LIKE '%/attendance-images/%'
    OR avatar_url LIKE '%/attendance-images-prod/%'
    OR avatar_url LIKE 'http://minio:9000/%'
    OR avatar_url LIKE 'http://localhost:9000/%')
  AND avatar_url ~ '(avatars|faces|snapshots)/';

-- 2. Bảng face_data (5 trường ảnh eKYC)
UPDATE face_data
SET front_image_url = regexp_replace(front_image_url, '^.*?/(avatars|faces|snapshots)/', '\1/')
WHERE (front_image_url LIKE '/storage/%'
    OR front_image_url LIKE 'storage/%'
    OR front_image_url LIKE '%/attendance-images/%'
    OR front_image_url LIKE '%/attendance-images-prod/%'
    OR front_image_url LIKE 'http://minio:9000/%'
    OR front_image_url LIKE 'http://localhost:9000/%')
  AND front_image_url ~ '(avatars|faces|snapshots)/';

UPDATE face_data
SET blink_image_url = regexp_replace(blink_image_url, '^.*?/(avatars|faces|snapshots)/', '\1/')
WHERE (blink_image_url LIKE '/storage/%'
    OR blink_image_url LIKE 'storage/%'
    OR blink_image_url LIKE '%/attendance-images/%'
    OR blink_image_url LIKE '%/attendance-images-prod/%'
    OR blink_image_url LIKE 'http://minio:9000/%'
    OR blink_image_url LIKE 'http://localhost:9000/%')
  AND blink_image_url ~ '(avatars|faces|snapshots)/';

UPDATE face_data
SET left_image_url = regexp_replace(left_image_url, '^.*?/(avatars|faces|snapshots)/', '\1/')
WHERE (left_image_url LIKE '/storage/%'
    OR left_image_url LIKE 'storage/%'
    OR left_image_url LIKE '%/attendance-images/%'
    OR left_image_url LIKE '%/attendance-images-prod/%'
    OR left_image_url LIKE 'http://minio:9000/%'
    OR left_image_url LIKE 'http://localhost:9000/%')
  AND left_image_url ~ '(avatars|faces|snapshots)/';

UPDATE face_data
SET right_image_url = regexp_replace(right_image_url, '^.*?/(avatars|faces|snapshots)/', '\1/')
WHERE (right_image_url LIKE '/storage/%'
    OR right_image_url LIKE 'storage/%'
    OR right_image_url LIKE '%/attendance-images/%'
    OR right_image_url LIKE '%/attendance-images-prod/%'
    OR right_image_url LIKE 'http://minio:9000/%'
    OR right_image_url LIKE 'http://localhost:9000/%')
  AND right_image_url ~ '(avatars|faces|snapshots)/';

UPDATE face_data
SET up_image_url = regexp_replace(up_image_url, '^.*?/(avatars|faces|snapshots)/', '\1/')
WHERE (up_image_url LIKE '/storage/%'
    OR up_image_url LIKE 'storage/%'
    OR up_image_url LIKE '%/attendance-images/%'
    OR up_image_url LIKE '%/attendance-images-prod/%'
    OR up_image_url LIKE 'http://minio:9000/%'
    OR up_image_url LIKE 'http://localhost:9000/%')
  AND up_image_url ~ '(avatars|faces|snapshots)/';

-- 3. Bảng attendance_records (snapshot_url & checkout_snapshot_url)
UPDATE attendance_records
SET snapshot_url = regexp_replace(snapshot_url, '^.*?/(avatars|faces|snapshots)/', '\1/')
WHERE (snapshot_url LIKE '/storage/%'
    OR snapshot_url LIKE 'storage/%'
    OR snapshot_url LIKE '%/attendance-images/%'
    OR snapshot_url LIKE '%/attendance-images-prod/%'
    OR snapshot_url LIKE 'http://minio:9000/%'
    OR snapshot_url LIKE 'http://localhost:9000/%')
  AND snapshot_url ~ '(avatars|faces|snapshots)/';

UPDATE attendance_records
SET checkout_snapshot_url = regexp_replace(checkout_snapshot_url, '^.*?/(avatars|faces|snapshots)/', '\1/')
WHERE (checkout_snapshot_url LIKE '/storage/%'
    OR checkout_snapshot_url LIKE 'storage/%'
    OR checkout_snapshot_url LIKE '%/attendance-images/%'
    OR checkout_snapshot_url LIKE '%/attendance-images-prod/%'
    OR checkout_snapshot_url LIKE 'http://minio:9000/%'
    OR checkout_snapshot_url LIKE 'http://localhost:9000/%')
  AND checkout_snapshot_url ~ '(avatars|faces|snapshots)/';
