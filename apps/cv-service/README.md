# eManagement Computer Vision Service (CV Service)

Hạ tầng xử lý thị giác máy tính và nhận diện khuôn mặt AI cho hệ thống chấm công tự động eManagement.

## 🚀 Tính năng cốt lõi

1. **Khung Dựng Validation Pipeline**:
   - Phát hiện số lượng khuôn mặt (`NO_FACE`, `MULTIPLE_FACES`).
   - Kiểm tra chất lượng ảnh: Độ mờ Laplacian (`IMAGE_TOO_BLURRY`), Độ sáng (`IMAGE_TOO_DARK`), Kích thước (`FACE_TOO_SMALL`).
   - Kiểm tra Scan Zone vị trí trung tâm (`FACE_NOT_CENTERED`).
   - Kiểm tra tư thế đầu Yaw/Pitch/Roll (`FACE_POSE_INVALID`).
   - Đánh giá độ ổn định multi-frame (`FACE_UNSTABLE`).
   - Chống giả mạo Anti-Spoofing FFT & Texture spectrum (`SPOOF_DETECTED`).

2. **Embedding & Matching**:
   - Trích xuất Vector 128 chiều L2-Normalized bằng MobileNetV2 Deep Neural Network.
   - So khớp danh tính bằng Cosine Similarity.
   - Cơ chế phát hiện tranh chấp ứng viên (`AMBIGUOUS_MATCH`).

3. **API Endpoints**:
   - `GET /api/v1/cv/health`: Kiểm tra trạng thái hệ thống.
   - `POST /api/v1/cv/validate-frame`: Đánh giá chất lượng 1 khung hình camera.
   - `POST /api/v1/cv/enroll`: Đăng ký khuôn mặt nhân viên từ chuỗi 1-10 frames.
   - `POST /api/v1/cv/recognize`: Nhận diện nhân viên từ camera Kiosk.
   - `GET /docs`: Swagger UI dùng để kiểm thử API trực quan trên trình duyệt.

---

## 🛠️ Hướng dẫn khởi chạy chi tiết (Local Development)

### 1. Chuẩn bị thư mục & Cấu hình File `.env`
Di chuyển vào thư mục dịch vụ và copy file biến môi trường:
```bash
cd apps/cv-service
cp .env.example .env   # Trên Windows CMD/PowerShell: copy .env.example .env
```

### 2. Khởi tạo môi trường ảo Python (Virtual Environment)
Yêu cầu: **Python 3.10 - 3.12**

* **Trên Windows:**
  ```powershell
  python -m venv .venv
  ```
* **Trên Linux / macOS:**
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

### 3. Cài đặt các thư viện phụ thuộc
* **Trên Windows:**
  ```powershell
  .\.venv\Scripts\python.exe -m pip install --upgrade pip
  .\.venv\Scripts\python.exe -m pip install -r requirements.txt
  ```
* **Trên Linux / macOS:**
  ```bash
  pip install --upgrade pip
  pip install -r requirements.txt
  ```

### 4. Khởi chạy Uvicorn Server

* **Trên Windows (PowerShell - Chạy trực tiếp 100% không lỗi):**
  ```powershell
  $env:PYTHONPATH="."
  .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ```

* **Trên Linux / macOS / Git Bash:**
  ```bash
  PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ```

👉 Sau khi khởi chạy thành công, truy cập **Swagger UI** tại: `http://localhost:8000/docs`

---

## 🐳 Hướng dẫn khởi chạy bằng Docker

Nếu máy chưa cài sẵn Python, bạn chỉ cần dùng Docker:

```bash
# 1. Build Docker Image
docker build -t emanagement-cv-service:1.0.0 .

# 2. Run Container
docker run -d -p 8000:8000 --name cv-service emanagement-cv-service:1.0.0
```

---

## 🔗 Tích hợp với Spring Boot Backend

1. Đảm bảo `CV Service` đang chạy tại cổng `8000`.
2. Khởi chạy Spring Boot Backend ở cổng `2504` (profile `dev`).
3. Trong `application-dev.yml` của Backend:
   ```yaml
   ai-service:
     base-url: http://localhost:8000
     mock-enabled: false
   ```
4. Hệ thống sẽ tự động gọi nhau qua kết nối HTTP REST API!
