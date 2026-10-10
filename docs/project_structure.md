# Cấu trúc dự án (Project Structure)

Sơ đồ tổ chức mã nguồn và thư mục của hệ thống eManagement.

```txt
(project_root)/
├── apps/
│   ├── frontend/                      # Next.js Client App (App Router, TypeScript)
│   │   ├── app/                       # Route handlers, layouts, views
│   │   ├── components/                # Giao diện UI (ui/, shared/, employees/, shifts/...)
│   │   ├── hooks/                     # Custom React hooks (use-camera, use-ekyc-flow...)
│   │   ├── services/                  # Tầng gọi API Backend & CV Service
│   │   ├── lib/                       # Tiện ích apiClient, xử lý frame, MediaPipe
│   │   ├── types/                     # Định nghĩa kiểu dữ liệu TypeScript
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── backend/                       # Spring Boot Monolith Service (Java 21)
│   │   ├── src/main/java/             # Mã nguồn nghiệp vụ chia theo modules
│   │   │   └── com/emanagement/backend/modules/ (auth, employee, face, kiosk, attendance, shift, leave, alert...)
│   │   ├── src/main/resources/        # Cấu hình (application.yml, logging, db/)
│   │   ├── Dockerfile
│   │   ├── pom.xml
│   │   └── mvnw
│   └── cv-service/                    # Python Computer Vision Service (FastAPI)
│       ├── app/                       # Pipeline kiểm tra khung hình, trích xuất vector, API
│       ├── weights/                   # Trọng số mô hình nhận diện khuôn mặt
│       ├── Dockerfile
│       └── requirements.txt
├── docker/                            # Cấu hình các dịch vụ phụ trợ
│   ├── cloudflared/                   # Cấu hình DNS resolver cho Quick Tunnel
│   ├── grafana/                       # Cấu hình dashboards và data sources
│   ├── nginx/                         # Cấu hình Gateway Reverse Proxy định tuyến
│   └── prometheus/                    # Cấu hình scrape targets (Actuator, Nginx)
├── docs/                              # Tài liệu đặc tả nghiệp vụ & kiến trúc hệ thống
├── scripts/                           # Script tiện ích hỗ trợ quản trị
├── .env.example                       # File mẫu khai báo biến môi trường
├── docker-compose.yml                 # File khởi chạy toàn bộ hệ thống chính
├── docker-compose.monitoring.yml      # File Compose mở rộng cho hệ thống giám sát
├── docker-compose.resources.yml       # File Compose cấu hình giới hạn tài nguyên (CPU/RAM)
└── README.md                          # Hướng dẫn chạy và triển khai hệ thống
```
