# API Contract Specification

Tài liệu này đóng vai trò là quy chuẩn giao tiếp (API Standards & Conventions)
thống nhất giữa Frontend (Web/Mobile), thiết bị ngoại vi (Kiosk) và các dịch vụ
Backend của hệ thống eManagement.

Chi tiết từng endpoint (tham số, schema DTO, validation rule) được quản lý tự
động từ mã nguồn Controller thông qua SpringDoc OpenAPI / Swagger.

## I. Nguyên tắc thiết kế chung (General API Conventions)

### 1. Phân định không gian URI (Base Paths)

Hệ thống phân tách rõ rệt 2 không gian dịch vụ RESTful:

- **Core Business API (Spring Boot Backend):** Xử lý toàn bộ logic nghiệp vụ
  quản lý nhân sự, ca làm việc, chấm công, duyệt đơn từ và thống kê.
  - Base Path: `/api/v1`
- **Computer Vision API (FastAPI cv-service):** Xử lý kiểm tra trực tiếp khung
  hình camera real-time và đăng ký vector khuôn mặt.
  - Base Path: `/api/v1/cv`

### 2. Chuẩn HTTP Methods & Mã trạng thái (Status Codes)

Hệ thống tuân thủ chuẩn thiết kế RESTful:

<table>
  <thead>
    <tr>
      <th>HTTP Method</th>
      <th>Mục đích sử dụng</th>
      <th>Mã HTTP Status Code thành công</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>GET</code></td>
      <td>Truy vấn dữ liệu (đơn lẻ hoặc danh sách phân trang)</td>
      <td><code>200 OK</code></td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td>Tạo mới tài nguyên, xác thực hoặc thực hiện tác vụ xử lý</td>
      <td><code>201 Created</code> hoặc <code>200 OK</code> (với tác vụ bất đồng bộ: <code>202 Accepted</code>)</td>
    </tr>
    <tr>
      <td><code>PUT</code></td>
      <td>Cập nhật toàn phần tài nguyên hoặc thay đổi trạng thái xác nhận</td>
      <td><code>200 OK</code></td>
    </tr>
    <tr>
      <td><code>DELETE</code></td>
      <td>Xóa hoặc vô hiệu hóa tài nguyên</td>
      <td><code>200 OK</code></td>
    </tr>
  </tbody>
</table>

Các mã lỗi HTTP tiêu chuẩn được áp dụng thống nhất:

<table>
  <thead>
    <tr>
      <th>Status Code</th>
      <th>Ý nghĩa</th>
      <th>Kịch bản trả về</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>400 Bad Request</code></td>
      <td>Yêu cầu không hợp lệ</td>
      <td>Dữ liệu đầu vào sai định dạng hoặc vi phạm quy tắc nghiệp vụ.</td>
    </tr>
    <tr>
      <td><code>401 Unauthorized</code></td>
      <td>Chưa xác thực</td>
      <td>Thiếu Bearer Token, token sai hoặc token đã hết hạn.</td>
    </tr>
    <tr>
      <td><code>403 Forbidden</code></td>
      <td>Không có quyền truy cập</td>
      <td>Tài khoản không đủ quyền vai trò (Role-Based Access Control) để gọi tài nguyên.</td>
    </tr>
    <tr>
      <td><code>404 Not Found</code></td>
      <td>Không tìm thấy</td>
      <td>ID tài nguyên không tồn tại trong cơ sở dữ liệu.</td>
    </tr>
    <tr>
      <td><code>409 Conflict</code></td>
      <td>Xung đột dữ liệu</td>
      <td>Trùng lặp dữ liệu duy nhất (Mã nhân viên, Email, Số điện thoại) hoặc xung đột trạng thái dữ liệu.</td>
    </tr>
    <tr>
      <td><code>500 Internal Server Error</code></td>
      <td>Lỗi hệ thống nội bộ</td>
      <td>Lỗi phát sinh ngoài dự kiến từ phía máy chủ.</td>
    </tr>
  </tbody>
</table>

> [!IMPORTANT] **Vị trí của mã số HTTP Status Code:** Toàn bộ mã số HTTP (200,
> 201, 400, 401, 403, 404, 409, 500) được truyền tải qua **HTTP Response Header
> (tầng giao thức mạng)**. Phần thân (body) JSON không chứa trường số
> `statusCode` hay `code`, mà sử dụng trường `status` dạng chuỗi để phân loại
> kết quả (`SUCCESS`, `ERROR`, `VALIDATION_ERROR`).

### 3. Cơ chế Xác thực & Phân quyền (Authentication & Authorization)

- **Người dùng (Web / Mobile):**
  - Truyền JWT qua Header: `Authorization: Bearer <access_token>`
  - Vai trò phân quyền (RBAC): `ROLE_ADMIN` (Quản trị viên) và `ROLE_USER` (Nhân
    viên).
- **Luồng làm mới Token (Refresh Token Rotation):**
  - Khi Access Token hết hạn (nhận mã HTTP 401), Client không đăng xuất ngay mà
    gửi yêu cầu cấp mới:
    - **Endpoint:** `POST /api/v1/auth/refresh-token`
    - **Request Body:**
      ```json
      {
        "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
      ```
    - **Response Data:**
      ```json
      {
        "status": "SUCCESS",
        "message": "Làm mới token thành công",
        "data": {
          "accessToken": "eyJhbGciOiJIUzI1Ni...",
          "refreshToken": "eyJhbGciOiJIUzI1Ni...",
          "tokenType": "Bearer"
        },
        "timestamp": "2026-08-24T12:00:00"
      }
      ```
  - Hệ thống áp dụng cơ chế **Token Rotation**: Mỗi khi cấp Access Token mới,
    một Refresh Token mới cũng sẽ được sinh ra để thay thế token cũ. Client cần
    lưu lại cặp token mới này.
- **Trạm Kiosk chấm công phần cứng:**
  - Xác thực trạm qua Header: `X-Kiosk-Token: <device_token>`
  - Trạm gửi kèm frame ảnh Base64 để thực hiện chấm công tự động.

### 4. Quy ước định dạng dữ liệu (Data Format Conventions)

- **Thời gian (ISO-8601):**
  - Datetime: `yyyy-MM-dd'T'HH:mm:ss` (Ví dụ: `2026-08-24T08:30:00`)
  - Date: `yyyy-MM-dd` (Ví dụ: `2026-08-24`)
  - Time: `HH:mm:ss` (Ví dụ: `08:00:00`)
- **Bộ ký tự:** Toàn bộ request và response sử dụng `UTF-8`.
- **Quy chuẩn Content-Type & Tải lên tệp (File Uploads):**
  - Mặc định toàn hệ thống sử dụng: `application/json` (bao gồm cả chuỗi Base64
    ảnh chân dung eKYC và frame ảnh Kiosk).
  - Ngoại lệ duy nhất cho tính năng nạp nhân viên hàng loạt
    (`BulkImportController`):
    - Endpoint: `POST /api/v1/employees/bulk-import`
    - Content-Type: `multipart/form-data`
    - Tên form field: `file`
    - Định dạng tệp: File nén `.zip` chứa file `employees.csv` và thư mục ảnh
      chân dung (dung lượng tối đa 150MB).

## II. Cấu trúc Response & Định dạng lỗi (Data Envelopes)

### 1. Chuẩn Envelope của Core Business API (Spring Boot)

Toàn bộ phản hồi từ Spring Boot Backend đều được đóng gói trong đối tượng phản
hồi tiêu chuẩn:

#### Phản hồi thành công đơn lẻ (Single Success)

```json
{
  "status": "SUCCESS",
  "message": "Thao tác thành công",
  "data": { ... },
  "timestamp": "2026-08-24T12:00:00"
}
```

#### Phản hồi danh sách phân trang (Paginated Success)

Dữ liệu trả về nằm trong thuộc tính `data` dưới cấu trúc phân trang:

```json
{
  "status": "SUCCESS",
  "message": "Thao tác thành công",
  "data": {
    "content": [ ... ],
    "pageNumber": 0,
    "pageSize": 10,
    "totalElement": 42,
    "totalPages": 5,
    "last": false
  },
  "timestamp": "2026-08-24T12:00:00"
}
```

> [!NOTE] **Quy ước tham số phân trang:**
>
> - Tham số `page`: Đánh số theo cơ chế **0-indexed** (trang đầu tiên là
>   `page=0`, trang thứ hai là `page=1`).
> - Tham số `size`: Số lượng bản ghi trên một trang (mặc định là `10`).
> - Tham số `sort`: Định dạng `<tên_trường>,<hướng_sắp_xếp>` (ví dụ:
>   `?sort=id,desc` hoặc `?sort=createdAt,asc`).
> - URL mẫu: `GET /api/v1/employees?page=0&size=10&sort=id,desc`

#### Phản hồi lỗi nghiệp vụ (Business Error)

```json
{
  "status": "ERROR",
  "message": "Mã nhân viên NV001 đã tồn tại trong hệ thống",
  "data": null,
  "timestamp": "2026-08-24T12:00:00"
}
```

#### Phản hồi lỗi kiểm tra dữ liệu đầu vào (Validation Error)

```json
{
  "status": "VALIDATION_ERROR",
  "message": "Dữ liệu đầu vào không hợp lệ",
  "data": {
    "email": "Email không đúng định dạng",
    "password": "Mật khẩu phải chứa ít nhất 6 ký tự"
  },
  "timestamp": "2026-08-24T12:00:00"
}
```

### 2. Chuẩn Envelope của Computer Vision API (FastAPI)

Computer Vision Service sử dụng envelope chuyên biệt phục vụ phản hồi trạng thái
thị giác theo thời gian thực cho Client:

```json
{
  "success": true,
  "status": "VALID",
  "message": "Khung hình hợp lệ.",
  "data": {
    "face_count": 1,
    "quality_score": 0.92,
    "position_valid": true,
    "pose": {
      "yaw": 1.2,
      "pitch": -0.8,
      "roll": 0.3,
      "is_valid": true
    },
    "details": {}
  }
}
```

#### Bảng danh mục mã trạng thái thị giác (CvStatus Dictionary)

Client bắt mã `status` để hiển thị nhắc nhở trực quan trên giao diện quét
camera:

<table>
  <thead>
    <tr>
      <th>Mã CvStatus</th>
      <th>Ý nghĩa trạng thái</th>
      <th>Thông điệp hệ thống (STATUS_MESSAGES)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>VALID</code></td>
      <td>Ảnh khuôn mặt đạt chuẩn</td>
      <td>Khung hình hợp lệ.</td>
    </tr>
    <tr>
      <td><code>NO_FACE</code></td>
      <td>Không tìm thấy khuôn mặt</td>
      <td>Không phát hiện khuôn mặt trong vùng camera.</td>
    </tr>
    <tr>
      <td><code>MULTIPLE_FACES</code></td>
      <td>Có nhiều hơn một khuôn mặt</td>
      <td>Phát hiện nhiều khuôn mặt trong vùng camera. Chỉ chấp nhận 1 người.</td>
    </tr>
    <tr>
      <td><code>FACE_TOO_SMALL</code></td>
      <td>Khuôn mặt ở quá xa</td>
      <td>Khuôn mặt quá nhỏ. Vui lòng tiến lại gần camera.</td>
    </tr>
    <tr>
      <td><code>FACE_NOT_CENTERED</code></td>
      <td>Khuôn mặt lệch khỏi vùng quét</td>
      <td>Khuôn mặt nằm ngoài vùng quét hợp lệ. Vui lòng di chuyển vào giữa.</td>
    </tr>
    <tr>
      <td><code>FACE_POSE_INVALID</code></td>
      <td>Góc quay đầu lệch quá ngưỡng</td>
      <td>Góc nghiêng khuôn mặt không hợp lệ. Vui lòng nhìn thẳng vào camera.</td>
    </tr>
    <tr>
      <td><code>FACE_UNSTABLE</code></td>
      <td>Khuôn mặt chuyển động liên tục</td>
      <td>Vị trí khuôn mặt chưa ổn định. Vui lòng giữ nguyên tư thế.</td>
    </tr>
    <tr>
      <td><code>IMAGE_TOO_BLURRY</code></td>
      <td>Ảnh bị mờ nhòe (Laplacian blur)</td>
      <td>Hình ảnh bị mờ. Vui lòng giữ yên hoặc kiểm tra ống kính camera.</td>
    </tr>
    <tr>
      <td><code>IMAGE_TOO_DARK</code></td>
      <td>Ánh sáng quá yếu</td>
      <td>Chưa đủ ánh sáng để chấm công. Vui lòng điều chỉnh ánh sáng để khuôn mặt được chiếu sáng rõ.</td>
    </tr>
    <tr>
      <td><code>LOW_FACE_QUALITY</code></td>
      <td>Chất lượng chung không đạt</td>
      <td>Chất lượng khuôn mặt không đạt yêu cầu.</td>
    </tr>
    <tr>
      <td><code>SPOOF_DETECTED</code></td>
      <td>Phát hiện giả mạo khuôn mặt (Anti-Spoofing)</td>
      <td>Phát hiện hành vi giả mạo khuôn mặt (Anti-Spoofing).</td>
    </tr>
    <tr>
      <td><code>UNKNOWN_FACE</code></td>
      <td>Không nhận diện được nhân viên</td>
      <td>Không nhận diện được nhân viên trên hệ thống.</td>
    </tr>
    <tr>
      <td><code>AMBIGUOUS_MATCH</code></td>
      <td>Tranh chấp nhận diện (khoảng cách 2 ứng viên quá gần)</td>
      <td>Độ tương đồng giữa các ứng viên quá gần nhau. Không thể xác định chính xác.</td>
    </tr>
    <tr>
      <td><code>MATCHED</code></td>
      <td>Nhận diện thành công</td>
      <td>Nhận diện thành công.</td>
    </tr>
    <tr>
      <td><code>ENROLLMENT_SUCCESS</code></td>
      <td>Đăng ký khuôn mặt thành công</td>
      <td>Đăng ký dữ liệu khuôn mặt thành công.</td>
    </tr>
    <tr>
      <td><code>INVALID_IMAGE</code></td>
      <td>Dữ liệu ảnh không hợp lệ / lỗi Base64</td>
      <td>Không đọc được dữ liệu hình ảnh gửi lên.</td>
    </tr>
    <tr>
      <td><code>MODEL_NOT_READY</code></td>
      <td>Trọng số mô hình AI chưa sẵn sàng</td>
      <td>Mô hình AI chưa được nạp. Vui lòng liên hệ quản trị hệ thống.</td>
    </tr>
    <tr>
      <td><code>INTERNAL_ERROR</code></td>
      <td>Lỗi máy chủ thị giác máy tính</td>
      <td>Lỗi xử lý nội bộ dịch vụ AI.</td>
    </tr>
  </tbody>
</table>

## III. Cơ chế tra cứu đặc tả Endpoint (Dynamic Specification)

Nhằm đảm bảo tính chính xác tuyệt đối (Single Source of Truth) và loại bỏ nguy
cơ tài liệu bị lệch pha với mã nguồn, toàn bộ danh mục endpoint, DTO
request/response, validation rules và mô tả chi tiết được duy trì trực tiếp
trong code:

- **Backend Spring Boot (Core Business):**
  - Khởi động backend độc lập ở môi trường phát triển: `http://localhost:8080`
  - Giao diện trực quan Swagger UI:
    `http://localhost:8080/swagger-ui/index.html`
  - Tài liệu OpenAPI JSON: `http://localhost:8080/v3/api-docs`
- **Computer Vision Service (FastAPI):**
  - Khởi động CV service độc lập ở môi trường phát triển:
    `http://localhost:8000`
  - Giao diện OpenAPI Swagger: `http://localhost:8000/docs`
