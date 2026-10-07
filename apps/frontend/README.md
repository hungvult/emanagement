# eManagement frontend

Next.js App Router, React, TypeScript và Tailwind CSS. Quản lý nhân viên, phân ca, nghỉ phép, thông báo và chấm công bằng khuôn mặt.

## Cấu trúc

| Thư mục                                       | Trách nhiệm                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `app/`                                        | Route, layout và ghép màn hình.                                                 |
| `components/ui/`                              | Button, input, modal, table, toast dùng chung.                                  |
| `components/shared/`                          | AuthGuard và RoleGuard.                                                         |
| `components/employees/`, `components/shifts/` | Bộ lọc, bảng/lịch và dialog theo nghiệp vụ; nhận dữ liệu và callback qua props. |
| `hooks/employees/`, `hooks/shifts/`           | State, tải dữ liệu và thao tác nghiệp vụ.                                       |
| `hooks/use-camera.ts`                         | Quản lý stream, quyền camera và gắn video; dùng chung cho eKYC và chấm công.    |
| `hooks/use-ekyc-flow.ts`                      | Điều phối 5 bước eKYC, kiểm tra ảnh và lưu kết quả.                             |
| `services/`                                   | Gọi API; component không tự xử lý token hoặc dựng HTTP request.                 |
| `types/`                                      | Kiểu request, response và dữ liệu nghiệp vụ.                                    |
| `lib/`                                        | HTTP client, MediaPipe, âm thanh, xử lý frame và helper.                        |
| `constants/`                                  | Cấu hình các bước eKYC.                                                         |
| `tests/`                                      | Hồi quy phiên đăng nhập, camera, chống quét lặp và eKYC.                        |

Luồng dữ liệu: **route → hook → service → apiClient → API**. Hook nhận kết quả và truyền xuống component. `apiClient` gắn token, phối hợp refresh token và trả body đã giải mã. CV có envelope trạng thái riêng nên `cv.service.ts` kiểm tra response ở ranh giới API.

Dùng alias `@/` cho import nội bộ. Khi thêm chức năng, định nghĩa kiểu dữ liệu và service, đưa xử lý vào hook rồi ghép component ở route. UI chung đặt trong `components/ui`; UI nghiệp vụ đặt trong thư mục chức năng tương ứng.

Guard trình duyệt phục vụ điều hướng và ẩn màn hình không có quyền. Backend vẫn phải xác thực và kiểm tra quyền trên mọi API; localStorage không bảo vệ API phía server.

## Chạy local

Yêu cầu Node.js 20 trở lên và npm. Backend, CV service và MinIO cần chạy cho các chức năng tương ứng.

```powershell
cd apps/frontend
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Mở `http://localhost:3000`. `predev` và `prebuild` tự sao chép tài nguyên MediaPipe đã khóa phiên bản vào `public/vendor`; không cần CDN. Không commit thư mục sinh tự động này.

| Biến                                    | Ý nghĩa                                                     |
| --------------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                   | URL API nhìn từ browser; `/api/v1` dùng proxy cùng origin.  |
| `NEXT_PUBLIC_ATTENDANCE_BRIGHTNESS_MIN` | Ngưỡng ánh sáng frontend, mặc định 100; cần đồng bộ với CV. |
| `INTERNAL_BACKEND_URL`                  | Đích rewrite API, mặc định `http://localhost:8080`.         |
| `INTERNAL_CV_SERVICE_URL`               | Đích rewrite CV, mặc định `http://localhost:8000`.          |
| `INTERNAL_MINIO_URL`                    | Đích rewrite `/storage`, mặc định `http://localhost:9000`.  |

CV luôn gọi `/api/v1/cv` cùng origin. Camera cần HTTPS khi triển khai; localhost được browser cho phép dùng khi phát triển. Không đặt secret trong biến `NEXT_PUBLIC_*` vì chúng xuất hiện trong mã browser.

## Kiểm tra

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Test dùng API/frame mô phỏng để kiểm tra logic hồi quy. Cần thử camera thật và backend để xác nhận nhận diện và chấm công tích hợp. Lint, TypeScript và test có thể dùng làm kiểm tra bắt buộc trong CI.

Phân ca được chia thành `use-shifts` (điều phối lịch), `use-shift-catalog` (tạo/sửa/xóa ca), `use-bulk-assignment` (phân ca hàng loạt) và `use-copy-week` (sao chép tuần). Các hook thao tác nhận callback tải lại dữ liệu từ hook điều phối.

Một số effect có ngoại lệ lint cục bộ, kèm lý do, để đặt trạng thái loading hoặc reset khi bắt đầu request/camera. HTTP client cố ý tải lại trang khi phiên hết hạn để xóa state đã đăng nhập. Không tắt những quy tắc này trên toàn dự án.

## Triển khai

Frontend cấu hình `output: "standalone"`. Dockerfile đóng gói server, static và public; chạy bằng user không có quyền root. `NEXT_PUBLIC_*` được đưa vào lúc build; thay giá trị cần build lại image.

Từ thư mục gốc:

```powershell
docker compose build frontend
docker compose up -d frontend
docker exec emanagement-nginx nginx -s reload
```

Compose dùng `/api/v1` để browser gọi qua Nginx, chuyển tiếp tới backend/CV và storage. Reload Nginx sau khi tạo lại container để cập nhật upstream. Kiểm tra trạng thái container bằng `docker compose ps` và đăng nhập tại `http://localhost` bằng tài khoản của backend. Health frontend là `/api/health` trên cổng Next.js bên trong container; Nginx chuyển `/api/` tới backend nên không dùng đường dẫn này qua cổng 80 để kiểm tra frontend.

Khi chạy Next độc lập, cấu hình `INTERNAL_*` trước khi build/chạy và kiểm tra rewrite ở môi trường đích. Artifact standalone chạy bằng Docker hoặc `node .next/standalone/server.js` sau khi sao chép `public` và `.next/static` vào vị trí tương ứng trong artifact.
