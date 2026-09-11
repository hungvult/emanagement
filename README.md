# Hệ Thống Quản Lý Chấm Công & Phân Quyền eManagement

Dự án **eManagement** là hệ thống quản lý nhân sự và chấm công tự động thông minh, kết hợp công nghệ **AI Computer Vision (Nhận diện khuôn mặt eKYC)** và nền tảng **Backend Spring Boot 3 / Java 21** theo kiến trúc module chuẩn doanh nghiệp (Package-by-Feature).

---

## 1. Tính Năng Nổi Bật

- **Đăng Nhập Đa Năng Chuẩn Hiện Đại 2026**:
  - Hỗ trợ đăng nhập linh hoạt bằng **Mã nhân viên** (`EMP260001`), **Email** hoặc **Số điện thoại**.
  - Cơ chế tự động khóa tài khoản (15 phút) khi nhập sai mật khẩu quá 5 lần liên tiếp (chống tấn công Brute-force).
  - Tự phục vụ (Self-service): Nhân viên tự cập nhật thông tin cá nhân (Email/SĐT) kèm xác thực mã OTP 6 số qua Email/SMS.
- **Tự Động Sinh Mã Nghiệp Vụ Nghiêm Ngặt Phía Server**:
  - Mã nhân viên: `EMP` + 2 số năm + 4 số STT (Ví dụ: `EMP260001`, `EMP260002`...).
  - Mã trạm Kiosk: `KSK-` + 4 số năm tháng + `-` + 3 số STT (Ví dụ: `KSK-2608-001`...).
  - Mã ca làm việc: `SHIFT-` + 3 số STT (Ví dụ: `SHIFT-001`, `SHIFT-002`...).
- **Xác Thực Trạm Kiosk Bằng Hardware JWT Device Token**:
  - Thiết bị trạm chấm công (Kiosk) được cấp Token có chữ ký số HMAC-SHA256 thời hạn 10 năm.
  - Xác thực 2 lớp: Kiểm tra tính toàn vẹn của chữ ký số mật mã và trạng thái hoạt động trong CSDL.
- **Quy Trình Quét Khuôn Mặt Live eKYC (Enrollment)**:
  - Quét khuôn mặt trực tiếp qua camera đa góc (chính diện, nghiêng trái, nghiêng phải), trích xuất vector embeddings 128 chiều mà không cần upload file ảnh tĩnh thủ công.
- **Chấm Công AI Realtime & Phát Hiện Sự Cố**:
  - Đọ sánh khuôn mặt realtime với độ chính xác cao.
  - Tự động phát hiện và cảnh báo khuôn mặt lạ (`UNKNOWN_FACE`) vào hệ thống quản trị.
- **Tài Liệu API Chuẩn OpenAPI 3.0 (Swagger UI)**:
  - Tích hợp sẵn tại `/swagger-ui.html` với đầy đủ schema mô tả tiếng Việt có dấu và tự động phân giải mã lỗi `400`, `401`, `403`, `404`, `500`.

---

## 2. Cấu Trúc Dự Án (Monorepo Workspace)

```txt
mnm/
├── docs/                               # Toàn bộ tài liệu thiết kế hệ thống
│   ├── architecture.md                 # Kiến trúc Modular Package-by-Feature
│   ├── database-design.md              # Thiết kế CSDL PostgreSQL (11 bảng & DDL)
│   ├── srs.md                          # Đặc tả yêu cầu phần mềm chi tiết
│   ├── programming-guide-file.md       # Hướng dẫn lập trình chi tiết các giai đoạn
│   └── construction-guidelines.md      # Lộ trình 5 giai đoạn phát triển dự án
│
└── emanagement/                        # Mã nguồn ứng dụng
    └── apps/
        └── backend/                    # Spring Boot 3.x / Java 21 REST API Service
            ├── src/main/java/com/emanagement/backend/
            │   ├── config/             # Cấu hình Security, OpenAPI, DataInitializer
            │   ├── security/           # JWT Provider, Auth Filter, UserPrincipal
            │   ├── common/             # DTO chung, Validation Regex, Email Service, Exception
            │   └── modules/            # Danh sách Module nghiệp vụ (Package-by-Feature)
            │       ├── auth/           # Xác thực, Đăng nhập đa danh tính, OTP
            │       ├── employee/       # Quản lý nhân viên, eKYC Live Enrollment
            │       ├── kiosk/          # Trạm Kiosk, Hardware JWT Device Token
            │       ├── attendance/     # Lịch sử chấm công
            │       ├── shift/          # Ca làm việc & phân ca
            │       ├── leave/          # Đơn xin nghỉ phép & phê duyệt
            │       ├── alert/          # Cảnh báo bất thường AI
            │       └── face/           # AI Face Embedding & Matching
            └── src/main/resources/
                ├── application.yml
                ├── application-dev.yml
                └── application-prod.yml
```

---

## 3. Yêu Cầu Môi Trường (Prerequisites)

- **Java**: OpenJDK 21 LTS trở lên.
- **Maven**: 3.9+ (hoặc sử dụng script `./mvnw` đính kèm).
- **PostgreSQL**: Phiên bản 14 trở lên.
- **MinIO**: Object Storage lưu trữ ảnh chấm công (hoặc tương thích AWS S3).
- **AI Service** *(Tùy chọn khi dev)*: Python FastAPI AI Engine (mặc định Backend có `MockAiFaceService` chạy độc lập khi test).

---

## 4. Hướng Dẫn Cài Đặt & Khởi Chạy Backend

### Bước 1: Chuẩn Bị Cơ Sở Dữ Liệu PostgreSQL

Khởi tạo cơ sở dữ liệu `emanagement_db` trên PostgreSQL:

```sql
CREATE DATABASE emanagement_db;
```

Cập nhật thông tin kết nối trong `apps/backend/src/main/resources/application-dev.yml` (hoặc `application-prod.yml`):

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/emanagement_db
    username: dung
    password: dung123
```

*Lưu ý:* Bảng `kiosks` sử dụng cột `device_token TEXT` để chứa JWT Token dài hạn. Nếu bạn dùng CSDL đã có từ trước, vui lòng chạy:
```sql
ALTER TABLE kiosks ALTER COLUMN device_token TYPE TEXT;
```

### Bước 2: Biên Dịch Dự Án

Di chuyển vào thư mục `apps/backend` và biên dịch mã nguồn:

```bash
cd apps/backend
./mvnw clean compile
```

### Bước 3: Khởi Chạy Ứng Dụng

Chạy ứng dụng với môi trường phát triển (`dev`):

```bash
cd apps/backend
./mvnw spring-boot:run
```

- Môi trường `dev` chạy tại cổng: `http://localhost:2504` (toàn bộ API được mở `permitAll` để thuận tiện test Postman).
- Môi trường `prod` chạy tại cổng: `http://localhost:8080` (kích hoạt bảo vệ nghiêm ngặt bằng JWT Security).

Khi khởi động lần đầu, hệ thống tự động nạp dữ liệu mẫu (`DataInitializer`):
- Tài khoản Quản lý: `admin@emanagement.com` / Mật khẩu: `admin123` (Mã: `EMP260001`).
- Tài khoản Nhân viên: `nhanvien@emanagement.com` / Mật khẩu: `nhanvien123` (Mã: `EMP260002`).
- Ca làm việc mặc định: `SHIFT-001` (Ca hành chính 08:00 - 17:00).
- Trạm Kiosk mẫu: `KSK-2608-001` (Kèm Hardware JWT Device Token hợp lệ).

---

## 5. Tài Liệu API & Kiểm Thử

Sau khi khởi chạy ứng dụng, truy cập vào giao diện tương tác Swagger UI:

- **Swagger UI**: [http://localhost:2504/swagger-ui.html](http://localhost:2504/swagger-ui.html) *(trên profile dev)* hoặc [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) *(trên profile prod)*
- **OpenAPI Schema (JSON)**: `/v3/api-docs`

---

## 6. Danh Mục API Endpoints Chính

| Module | Phương thức | Endpoint | Mô tả |
| :--- | :---: | :--- | :--- |
| **Xác thực** | `POST` | `/api/v1/auth/login` | Đăng nhập bằng Mã NV / Email / SĐT |
| | `POST` | `/api/v1/auth/send-otp` | Gửi mã OTP 6 số xác thực |
| | `POST` | `/api/v1/auth/verify-otp` | Kiểm tra tính hợp lệ của mã OTP |
| | `POST` | `/api/v1/auth/reset-password` | Đặt lại mật khẩu an toàn qua OTP |
| | `PUT` | `/api/v1/auth/profile` | Tự cập nhật hồ sơ cá nhân kèm mã OTP |
| | `GET` | `/api/v1/auth/me` | Lấy thông tin tài khoản hiện tại từ JWT |
| **Nhân viên** | `POST` | `/api/v1/employees` | Thêm nhân viên mới (Mã `EMP26xxxx` tự sinh) |
| | `GET` | `/api/v1/employees` | Danh sách nhân viên (Phân trang) |
| | `GET` | `/api/v1/employees/{id}` | Chi tiết hồ sơ nhân viên |
| | `PUT` | `/api/v1/employees/{id}` | Cập nhật thông tin nhân viên |
| | `DELETE` | `/api/v1/employees/{id}` | Xóa nhân viên khỏi hệ thống |
| | `POST` | `/api/v1/employees/ekyc-enroll` | Đăng ký dữ liệu khuôn mặt Live eKYC |
| **Trạm Kiosk** | `POST` | `/api/v1/kiosks/register` | Đăng ký Kiosk mới (Cấp mã `KSK-` & Hardware JWT) |
| | `POST` | `/api/v1/kiosks/check-in` | Tiếp nhận frame camera chấm công AI realtime |
| **Chấm công** | `GET` | `/api/v1/attendances/my-history` | Tra cứu lịch sử chấm công cá nhân |
| | `GET` | `/api/v1/attendances/records` | Toàn bộ nhật ký chấm công (Quản lý) |
| **Ca làm việc** | `POST` | `/api/v1/shifts` | Tạo mới ca làm việc (Mã `SHIFT-xxx` tự sinh) |
| | `GET` | `/api/v1/shifts` | Danh sách ca làm việc |
| | `POST` | `/api/v1/shifts/assign` | Phân ca làm việc cho nhân viên |
| **Nghỉ phép** | `POST` | `/api/v1/leave-requests` | Tạo đơn xin nghỉ phép |
| | `GET` | `/api/v1/leave-requests/my` | Danh sách đơn nghỉ phép cá nhân |
| | `GET` | `/api/v1/leave-requests` | Danh sách toàn bộ đơn nghỉ phép |
| | `PUT` | `/api/v1/leave-requests/{id}/approve` | Quản lý phê duyệt hoặc từ chối đơn |
| **Cảnh báo AI** | `GET` | `/api/v1/alerts` | Danh sách cảnh báo sự cố khuôn mặt lạ |
| | `PUT` | `/api/v1/alerts/{id}/resolve` | Đánh dấu xử lý cảnh báo |
