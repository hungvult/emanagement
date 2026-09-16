# Hệ Thống Quản Lý Chấm Công & Phân Quyền eManagement

Dự án **eManagement** là giải pháp toàn diện cho quản lý nhân sự, phân ca và chấm công tự động thông minh bằng nhận diện khuôn mặt (**AI Computer Vision / eKYC Live Face Matching**), kết hợp kiến trúc **Backend Spring Boot 3 (Java 21)** chuẩn module (Package-by-Feature) và giao diện **Frontend Next.js 14**.

Toàn bộ hệ thống được đóng gói và sẵn sàng khởi chạy đồng bộ thông qua **Docker & Docker Compose**.

---

## 1. Kiến Trúc Dịch Vụ & Công Nghệ

```
                                    ┌──────────────────────┐
                                    │    Client Browser    │
                                    │   (Camera / Kiosk)   │
                                    └──────────┬───────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │                                               │
                       ▼ :3000                                         ▼ :8080
            ┌─────────────────────┐                         ┌─────────────────────┐
            │   Frontend Next.js  │ ──────────────────────► │   Backend Service   │
            │   (React / Tailwind)│                         │ (Spring Boot / J21) │
            └─────────────────────┘                         └──────────┬──────────┘
                                                                       │
                       ┌───────────────────────────────────────────────┼───────────────────────────────┐
                       │                                               │                               │
                       ▼ :8000                                         ▼ :5432                         ▼ :9000 / :9001
            ┌─────────────────────┐                         ┌─────────────────────┐         ┌─────────────────────┐
            │  AI CV-Service      │                         │  PostgreSQL DB      │         │  MinIO Storage      │
            │ (FastAPI / OpenCV)  │                         │  (Relational Data)  │         │  (Face Snapshots)   │
            └─────────────────────┘                         └─────────────────────┘         └─────────────────────┘
```

- **Frontend (`apps/frontend`)**: Next.js 14, React, TailwindCSS, MediaPipe Face Mesh, Live eKYC capture.
- **Backend (`apps/backend`)**: Spring Boot 3.x, Java 21, Spring Security 6 (JWT + Hardware Device Token), JPA/Hibernate.
- **CV Service (`apps/cv-service`)**: Python 3.12, FastAPI, OpenCV Zoo (YuNet Detect + SFace Embeddings + MiniFASNet Anti-Spoofing).
- **Database (`postgres`)**: PostgreSQL 16 Alpine.
- **Object Storage (`minio`)**: MinIO S3-compatible lưu trữ ảnh chụp check-in & snapshot khuôn mặt.

---

## 2. Yêu Cầu Môi Trường (Prerequisites)

- **Docker**: Phiên bản `24.0+` hoặc **Docker Desktop** mới nhất (đã bật Docker Compose V2).
- **Python 3.10+** *(chỉ cần để chạy script tải model AI trước khi khởi động container nếu máy host chưa có weights)*.
- **Git** (để clone & quản lý mã nguồn).

---

## 3. Chuẩn Bị Trước Khi Khởi Chạy

### Bước 1: Thiết lập biến môi trường (.env)
Tại thư mục gốc dự án `emanagement/`, sao chép file `.env.example` thành `.env`:

```bash
# Windows PowerShell:
Copy-Item .env.example .env

# Linux / macOS / Git Bash:
cp .env.example .env
```

Nội dung `.env` chuẩn mặc định:
```env
# Database PostgreSQL
DB_NAME=emanagement_db
DB_USER=dung
DB_PASSWORD=dung123
TZ=Asia/Ho_Chi_Minh

# MinIO Object Storage
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=attendance-images-prod
MINIO_PUBLIC_URL=http://localhost:9000

# Backend Service
SPRING_PROFILES_ACTIVE=prod
PORT=8080

# Frontend Service
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

### Bước 2: Tải trọng số mô hình AI (ONNX Model Weights)
Hệ thống AI nhận diện và chống giả mạo sử dụng các mô hình ONNX. Hãy chạy script để tự động tải về thư mục `apps/cv-service/weights/`:

```bash
# Chạy từ thư mục gốc emanagement/
python apps/cv-service/scripts/download_models.py
```
> Script sẽ tự động kiểm tra mã băm SHA-256 để đảm bảo tính toàn vẹn của 3 mô hình:
> - `face_detection_yunet_2023mar.onnx` (Phát hiện khuôn mặt)
> - `face_recognition_sface_2021dec.onnx` (Trích xuất vector 128 chiều)
> - `2.7_80x80_MiniFASNetV2.onnx` (Chống giả mạo khuôn mặt Liveness/Anti-Spoofing)

---

## 4. Hướng Dẫn Chạy Bằng Docker Compose

### Cách 1: Chế độ Production (Khuyến nghị để chạy demo toàn diện)

Build và khởi chạy toàn bộ 5 dịch vụ (PostgreSQL, MinIO, CV-Service, Backend, Frontend) chạy ngầm:

```bash
docker compose up -d --build
```

- Theo dõi log thời gian thực của toàn bộ hệ thống:
  ```bash
  docker compose logs -f
  ```
- Theo dõi log riêng của từng service:
  ```bash
  docker compose logs -f backend
  docker compose logs -f cv-service
  docker compose logs -f frontend
  ```
- Dừng hệ thống:
  ```bash
  docker compose down
  ```
- Dừng và xóa toàn bộ dữ liệu (clean volume data):
  ```bash
  docker compose down -v
  ```

---

### Cách 2: Chế độ Development (Hot-Reload khi code)

Chế độ này mount trực tiếp mã nguồn từ máy của bạn vào container. Khi bạn sửa code ở `apps/frontend`, `apps/backend` hay `apps/cv-service`, ứng dụng sẽ tự động nạp lại (Hot-Reload) mà không cần build lại image:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

*(Thêm cờ `-d` nếu muốn chạy nền).*

- Dừng môi trường dev:
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.dev.yml down
  ```

---

## 5. Bảng Cổng & Địa Chỉ Truy Cập Dịch Vụ

Sau khi Docker khởi động thành công, các dịch vụ sẽ sẵn sàng tại các địa chỉ sau:

| Dịch vụ | Địa chỉ URL | Cổng (Port) | Mô tả |
| :--- | :--- | :---: | :--- |
| **Frontend Web App** | [http://localhost:3000](http://localhost:3000) | `3000` | Giao diện đăng nhập, quản trị, chấm công Kiosk & eKYC |
| **Backend REST API** | [http://localhost:8080](http://localhost:8080) | `8080` | Spring Boot 3 Core Backend |
| **Swagger API Docs** | [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) | `8080` | OpenAPI 3.0 Interactive Documentation |
| **AI CV Service** | [http://localhost:8000/api/v1/cv/health](http://localhost:8000/api/v1/cv/health) | `8000` | FastAPI Face Recognition Engine Health check |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | `9001` | Dashboard quản lý file/ảnh (User/Pass trong `.env`) |
| **MinIO S3 API** | [http://localhost:9000](http://localhost:9000) | `9000` | Endpoint lưu/đọc ảnh snapshot |
| **PostgreSQL Database**| `localhost:5432` | `5432` | Kết nối CSDL (`dung` / `dung123` / `emanagement_db`) |

---

## 6. Dữ Liệu Khởi Tạo & Tài Khoản Mẫu

Hệ thống được tích hợp sẵn bộ nạp dữ liệu tự động (`DataInitializer`) khi khởi động lần đầu:

### 👤 Tài khoản đăng nhập hệ thống:
1. **Quản trị viên (HR / Admin)**:
   - **Tài khoản**: `admin@emanagement.com` *(hoặc Mã NV: `EMP260001`)*
   - **Mật khẩu**: `admin123`
   - **Quyền hạn**: Quản lý toàn bộ nhân sự, ca làm, phê duyệt đơn nghỉ phép, cấu hình trạm Kiosk, giám sát cảnh báo AI.
2. **Nhân viên mẫu (Employee)**:
   - **Tài khoản**: `nhanvien@emanagement.com` *(hoặc Mã NV: `EMP260002`)*
   - **Mật khẩu**: `nhanvien123`
   - **Quyền hạn**: Xem lịch sử chấm công, gửi đơn xin nghỉ phép, cập nhật thông tin cá nhân.

### 🏢 Dữ liệu mẫu cấu hình sẵn:
- **Ca làm việc**: `SHIFT-001` (Ca hành chính: 08:00 - 17:00, cho phép check-in sớm 30p).
- **Trạm Kiosk mẫu**: `KSK-2608-001` (Đã được cấp sẵn Hardware JWT Device Token hợp lệ).

---

## 7. Quy Trình Trải Nghiệm Các Tính Năng Chính

1. **Đăng nhập hệ thống**:
   - Truy cập [http://localhost:3000](http://localhost:3000).
   - Đăng nhập bằng tài khoản Quản trị viên (`admin@emanagement.com` / `admin123`).

2. **Đăng ký khuôn mặt eKYC (Live Face Enrollment)**:
   - Vào mục Quản lý nhân viên -> Chọn nhân viên -> Chọn **Đăng ký khuôn mặt eKYC**.
   - Bật camera trực tiếp trên trình duyệt, quét các góc khuôn mặt để trích xuất vector đặc trưng gửi về backend.

3. **Chấm công tại trạm Kiosk (Live Attendance)**:
   - Mở giao diện trạm Kiosk tại trình duyệt của trạm.
   - Nhân viên đứng trước camera, hệ thống AI phát hiện khuôn mặt, kiểm tra liveness chống giả mạo, trích xuất embedding và ghi nhận lịch sử điểm danh theo ca realtime.

4. **Xác thực OTP & Tự đổi thông tin cá nhân**:
   - Nhân viên cập nhật Email/SĐT sẽ nhận mã OTP xác thực trước khi cập nhật vào hệ thống.

---

## 8. Danh Mục API Endpoints Chính (REST API)

| Module | Phương thức | Endpoint | Mô tả |
| :--- | :---: | :--- | :--- |
| **Xác thực** | `POST` | `/api/v1/auth/login` | Đăng nhập bằng Mã NV / Email / SĐT |
| | `POST` | `/api/v1/auth/send-otp` | Gửi mã OTP 6 số xác thực |
| | `POST` | `/api/v1/auth/verify-otp` | Kiểm tra tính hợp lệ của mã OTP |
| | `POST` | `/api/v1/auth/reset-password` | Đặt lại mật khẩu an toàn qua OTP |
| | `PUT` | `/api/v1/auth/profile` | Tự cập nhật hồ sơ cá nhân kèm mã OTP |
| | `GET` | `/api/v1/auth/me` | Lấy thông tin tài khoản hiện tại từ JWT |
| **Nhân viên** | `POST` | `/api/v1/employees` | Thêm nhân viên mới (Mã `EMP26xxxx` tự sinh) |
| | `GET` | `/api/v1/employees` | Danh sách nhân viên (Phân trang, tìm kiếm) |
| | `GET` | `/api/v1/employees/{id}` | Chi tiết hồ sơ nhân viên |
| | `PUT` | `/api/v1/employees/{id}` | Cập nhật thông tin nhân viên |
| | `DELETE` | `/api/v1/employees/{id}` | Xóa nhân viên khỏi hệ thống |
| | `POST` | `/api/v1/employees/ekyc-enroll` | Đăng ký vector khuôn mặt Live eKYC |
| **Trạm Kiosk** | `POST` | `/api/v1/kiosks/register` | Đăng ký Kiosk mới (Cấp mã `KSK-` & Hardware JWT) |
| | `POST` | `/api/v1/kiosks/check-in` | Tiếp nhận frame camera chấm công AI realtime |
| **Chấm công** | `GET` | `/api/v1/attendances/my-history` | Tra cứu lịch sử chấm công cá nhân |
| | `GET` | `/api/v1/attendances/records` | Toàn bộ nhật ký chấm công (Dành cho Quản lý) |
| **Ca làm việc** | `POST` | `/api/v1/shifts` | Tạo mới ca làm việc (Mã `SHIFT-xxx` tự sinh) |
| | `GET` | `/api/v1/shifts` | Danh sách ca làm việc |
| | `POST` | `/api/v1/shifts/assign` | Phân ca làm việc cho nhân viên |
| **Nghỉ phép** | `POST` | `/api/v1/leave-requests` | Tạo đơn xin nghỉ phép |
| | `GET` | `/api/v1/leave-requests/my` | Danh sách đơn nghỉ phép cá nhân |
| | `GET` | `/api/v1/leave-requests` | Danh sách toàn bộ đơn nghỉ phép |
| | `PUT` | `/api/v1/leave-requests/{id}/approve` | Quản lý phê duyệt hoặc từ chối đơn |
| **Cảnh báo AI** | `GET` | `/api/v1/alerts` | Danh sách cảnh báo sự cố khuôn mặt lạ |
| | `PUT` | `/api/v1/alerts/{id}/resolve` | Đánh dấu xử lý cảnh báo |

---

## 9. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

1. **Lỗi `cv-service` báo `MODEL_NOT_READY`**:
   - Nguyên nhân: Thư mục `apps/cv-service/weights/` chưa có file `.onnx` hoặc tải bị gián đoạn.
   - Khắc phục: Chạy `python apps/cv-service/scripts/download_models.py` trên máy host để tải lại đầy đủ các model.

2. **Lỗi xung đột cổng (Port already in use)**:
   - Đảm bảo các cổng `3000`, `8080`, `8000`, `5432`, `9000`, `9001` không bị ứng dụng khác trên máy chiếm dụng trước khi chạy `docker compose up`.

3. **Thay đổi file code nhưng Frontend/Backend không tự reload trong Docker Dev**:
   - Đảm bảo trong `.env` hoặc `docker-compose.dev.yml` cờ `WATCHPACK_POLLING=true` và `CHOKIDAR_USEPOLLING=true` được bật (đã cấu hình sẵn cho Windows/WSL2).

4. **Muốn xóa toàn bộ dữ liệu CSDL và MinIO để chạy lại từ đầu**:
   ```bash
   docker compose down -v
   docker compose up -d --build
   ```
