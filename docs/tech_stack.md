# Danh mục công nghệ (Technology Stack)

Tổng hợp toàn bộ các công nghệ, ngôn ngữ, thư viện và hạ tầng kỹ thuật được sử
dụng trong hệ thống eManagement.

## 1. Frontend

Giao diện người dùng web và trạm điểm danh camera trên trình duyệt.

<table>
  <thead>
    <tr>
      <th>Thành phần</th>
      <th>Công nghệ / Thư viện</th>
      <th>Vai trò trong hệ thống</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Core Framework</b></td>
      <td>Next.js (App Router), React, TypeScript</td>
      <td>Định tuyến route, render giao diện, quản lý state và ghép nối màn hình người dùng.</td>
    </tr>
    <tr>
      <td><b>Styling</b></td>
      <td>Tailwind CSS</td>
      <td>Xây dựng hệ thống giao diện responsive, hiện đại và đồng bộ design system.</td>
    </tr>
    <tr>
      <td><b>Client-side AI</b></td>
      <td>MediaPipe Face Mesh</td>
      <td>Phát hiện khuôn mặt, hướng dẫn 5 góc chụp eKYC, kiểm tra góc quay Yaw/Pitch/Roll trực tiếp trên browser trước khi gửi lên server.</td>
    </tr>
    <tr>
      <td><b>Network Client</b></td>
      <td>Fetch API, Custom API Client</td>
      <td>Gọi REST API, tự động gắn JWT Bearer token và xử lý luồng refresh token ngầm khi hết hạn.</td>
    </tr>
  </tbody>
</table>

## 2. Backend

Dịch vụ lõi xử lý toàn bộ logic nghiệp vụ, bảo mật và tương tác cơ sở dữ liệu.

<table>
  <thead>
    <tr>
      <th>Thành phần</th>
      <th>Công nghệ / Thư viện</th>
      <th>Vai trò trong hệ thống</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Platform</b></td>
      <td>Java 21, Spring Boot</td>
      <td>Nền tảng backend xử lý nghiệp vụ quản lý nhân sự, phân ca, duyệt nghỉ phép, điểm danh và cảnh báo.</td>
    </tr>
    <tr>
      <td><b>Security & Auth</b></td>
      <td>Spring Security, JJWT (io.jsonwebtoken)</td>
      <td>Xác thực người dùng, phân quyền vai trò (RBAC), cấp phát và giải mã cặp Access Token (JWT) / Refresh Token.</td>
    </tr>
    <tr>
      <td><b>Data Persistence</b></td>
      <td>Spring Data JPA, Hibernate, PostgreSQL Driver</td>
      <td>Thao tác cơ sở dữ liệu quan hệ, mapping thực thể (ORM), tối ưu query và quản lý transaction.</td>
    </tr>
    <tr>
      <td><b>DB Migration</b></td>
      <td>Flyway</td>
      <td>Quản lý phiên bản và tự động chạy các script migration cấu trúc bảng cơ sở dữ liệu.</td>
    </tr>
    <tr>
      <td><b>Storage SDK</b></td>
      <td>MinIO Java Client (8.5.7)</td>
      <td>Upload và truy xuất ảnh khuôn mặt eKYC, ảnh chụp snapshot đối soát chấm công qua giao thức tương thích AWS S3.</td>
    </tr>
    <tr>
      <td><b>Metrics & Monitor</b></td>
      <td>Spring Boot Actuator, Micrometer Prometheus</td>
      <td>Thu thập số liệu tài nguyên JVM, thời gian đáp ứng HTTP request, histogram SLA và cung cấp endpoint cho Prometheus.</td>
    </tr>
  </tbody>
</table>

## 3. Computer Vision (AI Service)

Dịch vụ chuyên biệt xử lý thị giác máy tính và nhận diện sinh trắc học khuôn
mặt.

<table>
  <thead>
    <tr>
      <th>Thành phần</th>
      <th>Công nghệ / Thư viện</th>
      <th>Vai trò trong hệ thống</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>API Service</b></td>
      <td>Python 3.10+, FastAPI, Uvicorn</td>
      <td>Cung cấp REST API hiệu năng cao phục vụ kiểm tra khung hình (`validate-frame`), đăng ký (`enroll`) và nhận diện (`recognize`).</td>
    </tr>
    <tr>
      <td><b>AI & Computer Vision</b></td>
      <td>OpenCV (cv2.dnn), NumPy, Pillow</td>
      <td>Xử lý ảnh ma trận, căn chỉnh khuôn mặt, chạy inference mô hình học sâu SFace và MobileNetV2 qua module DNN nhẹ và tối ưu.</td>
    </tr>
    <tr>
      <td><b>Feature Extraction</b></td>
      <td>Deep Neural Network (128D Embedding)</td>
      <td>Trích xuất vector đặc trưng khuôn mặt 128 chiều chuẩn hóa L2, hỗ trợ so khớp Cosine Similarity tốc độ cao.</td>
    </tr>
    <tr>
      <td><b>Anti-spoofing</b></td>
      <td>FFT Spectrum & Texture Analysis</td>
      <td>Phân tích tần số không gian và kết cấu để phát hiện giả mạo khuôn mặt bằng ảnh in hoặc màn hình thiết bị.</td>
    </tr>
  </tbody>
</table>

## 4. Dữ liệu & Lưu trữ (Data Layer)

<table>
  <thead>
    <tr>
      <th>Thành phần</th>
      <th>Công nghệ</th>
      <th>Vai trò trong hệ thống</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Relational Database</b></td>
      <td>PostgreSQL 16</td>
      <td>Lưu trữ dữ liệu có cấu trúc: tài khoản, nhân sự, lịch làm việc, ca trực, đơn nghỉ phép, nhật ký điểm danh và vector khuôn mặt.</td>
    </tr>
    <tr>
      <td><b>Object Storage</b></td>
      <td>MinIO</td>
      <td>Hệ thống lưu trữ đối tượng tương thích S3, quản lý file ảnh mẫu eKYC (`ekyc-faces`) và ảnh chụp camera điểm danh (`attendance-snapshots`).</td>
    </tr>
  </tbody>
</table>

## 5. Gateway, DevOps & Giám sát

<table>
  <thead>
    <tr>
      <th>Thành phần</th>
      <th>Công nghệ</th>
      <th>Vai trò trong hệ thống</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>API Gateway / Proxy</b></td>
      <td>Nginx</td>
      <td>Cổng đón tiếp duy nhất tại port 80; định tuyến request đến Next.js, Spring Boot, CV Service, MinIO và Grafana.</td>
    </tr>
    <tr>
      <td><b>Containerization</b></td>
      <td>Docker, Docker Compose</td>
      <td>Đóng gói và triển khai toàn bộ các service ứng dụng, cơ sở dữ liệu và monitoring trên môi trường mạng ảo hóa đồng nhất.</td>
    </tr>
    <tr>
      <td><b>Metrics Collector</b></td>
      <td>Prometheus</td>
      <td>Thu thập chỉ số hiệu năng định kỳ (scrape metrics) từ Spring Boot Actuator và Nginx.</td>
    </tr>
    <tr>
      <td><b>Visualization</b></td>
      <td>Grafana</td>
      <td>Trực quan hóa dashboard giám sát tài nguyên máy chủ, tải CPU, bộ nhớ RAM, JVM Heap, Garbage Collection và SLA độ trễ API.</td>
    </tr>
    <tr>
      <td><b>Public Tunnel</b></td>
      <td>Cloudflare Quick Tunnel (cloudflared)</td>
      <td>Cung cấp domain HTTPS tạm thời an toàn từ internet về Nginx mà không cần mở cổng port-forwarding trên router.</td>
    </tr>
  </tbody>
</table>
