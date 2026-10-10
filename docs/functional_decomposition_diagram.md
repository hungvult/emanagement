# Đặc tả phân rã chức năng (Functional Decomposition Specification)

Tài liệu đặc tả chi tiết cấu trúc phân rã chức năng (Functional Matrix) của hệ
thống quản trị chấm công nhận diện khuôn mặt (**eManagement**) gồm 9 phân hệ cốt
lõi.

## 1. Module auth: Xác thực & Tài khoản

Quản lý phiên làm việc, định danh người dùng và kiểm soát truy cập an toàn.

<table>
  <thead>
    <tr>
      <th>Mã</th>
      <th>Chức năng</th>
      <th>Tác nhân (Actor)</th>
      <th>Mô tả & Quy tắc nghiệp vụ (Business Rules)</th>
      <th>Ánh xạ Kỹ thuật / API</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>1.1</b></td>
      <td>Đăng nhập (Email/Code)</td>
      <td>Tất cả người dùng</td>
      <td>Đăng nhập bằng Email hoặc Mã nhân viên kèm mật khẩu. Hệ thống cấp cặp Access Token (JWT hiệu lực 30 phút) và Refresh Token (7 ngày).</td>
      <td>
        <code>POST /api/v1/auth/login</code><br>
        <code>POST /api/v1/auth/refresh-token</code><br>
        <code>POST /api/v1/auth/logout</code>
      </td>
    </tr>
    <tr>
      <td><b>1.2</b></td>
      <td>Gửi & Xác thực mã OTP</td>
      <td>Tất cả người dùng</td>
      <td>Gửi mã OTP ngẫu nhiên gồm 6 chữ số qua Email khi quên mật khẩu. OTP có hiệu lực trong 5 phút, giới hạn tối đa 3 lần thử sai.</td>
      <td>
        <code>POST /api/v1/auth/send-otp</code><br>
        <code>POST /api/v1/auth/verify-otp</code>
      </td>
    </tr>
    <tr>
      <td><b>1.3</b></td>
      <td>Đặt lại mật khẩu mới</td>
      <td>Tất cả người dùng</td>
      <td>Yêu cầu token xác thực hợp lệ từ bước xác nhận OTP. Mật khẩu mới phải đạt độ dài tối thiểu 8 ký tự, hỗ trợ đổi mật khẩu định kỳ.</td>
      <td>
        <code>POST /api/v1/auth/reset-password</code><br>
        <code>PUT /api/v1/auth/change-password</code>
      </td>
    </tr>
    <tr>
      <td><b>1.4</b></td>
      <td>Xem hồ sơ cá nhân</td>
      <td>Người dùng hiện tại</td>
      <td>Truy xuất thông tin định danh, vai trò (ROLE_ADMIN, ROLE_EMPLOYEE), quyền hạn phân ca và trạng thái dữ liệu Face ID của phiên đăng nhập.</td>
      <td>
        <code>GET /api/v1/auth/me</code><br>
        <code>PUT /api/v1/auth/profile</code>
      </td>
    </tr>
  </tbody>
</table>

## 2. Module employee: Quản lý Nhân sự

Quản trị thông tin hồ sơ nhân viên và trạng thái tài khoản.

<table>
  <thead>
    <tr>
      <th>Mã</th>
      <th>Chức năng</th>
      <th>Tác nhân (Actor)</th>
      <th>Mô tả & Quy tắc nghiệp vụ (Business Rules)</th>
      <th>Ánh xạ Kỹ thuật / API</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>2.1</b></td>
      <td>Tiếp nhận và Tạo mới nhân viên</td>
      <td>Quản trị viên / HR</td>
      <td>Tạo mới từng nhân sự hoặc nạp hàng loạt qua file Excel (Bulk Import). Mã nhân viên được kiểm tra trùng lặp trên toàn hệ thống.</td>
      <td>
        <code>POST /api/v1/employees</code><br>
        <code>POST /api/v1/employees/bulk-import</code>
      </td>
    </tr>
    <tr>
      <td><b>2.2</b></td>
      <td>Cập nhật hồ sơ và Thông tin liên hệ</td>
      <td>Quản trị viên / HR</td>
      <td>Điều chỉnh thông tin họ tên, chức danh, số điện thoại, email liên hệ và trạng thái công tác.</td>
      <td><code>PUT /api/v1/employees/{id}</code></td>
    </tr>
    <tr>
      <td><b>2.3</b></td>
      <td>Tra cứu, tìm kiếm</td>
      <td>Quản trị viên / HR</td>
      <td>Tìm kiếm đa tiêu chí theo tên, mã nhân viên, trạng thái hoạt động; hỗ trợ bộ lọc nâng cao và phân trang dữ liệu server-side.</td>
      <td>
        <code>GET /api/v1/employees</code><br>
        <code>GET /api/v1/employees/{id}</code>
      </td>
    </tr>
    <tr>
      <td><b>2.4</b></td>
      <td>Quản lý trạng thái tài khoản</td>
      <td>Quản trị viên / HR</td>
      <td>Thay đổi trạng thái tài khoản (ACTIVE, SUSPENDED, INACTIVE). Vô hiệu hóa mềm để bảo toàn lịch sử chấm công và ca làm cũ.</td>
      <td><code>DELETE /api/v1/employees/{id}</code></td>
    </tr>
    <tr>
      <td><b>2.5</b></td>
      <td>Quản trị dữ liệu Face ID</td>
      <td>Quản trị viên / HR</td>
      <td>Xem danh sách ảnh mẫu khuôn mặt đã đăng ký, cho phép xóa dữ liệu Face ID cũ khi nhân viên cần đăng ký lại eKYC mới.</td>
      <td>
        <code>GET /api/v1/employees/{id}/face-images</code><br>
        <code>DELETE /api/v1/employees/{id}/face</code>
      </td>
    </tr>
  </tbody>
</table>

## 3. Module face: Sinh trắc học eKYC

Quy trình thu thập, kiểm duyệt liveness và trích xuất vector khuôn mặt phục vụ
định danh tự động.

<table>
  <thead>
    <tr>
      <th>Mã</th>
      <th>Chức năng</th>
      <th>Tác nhân (Actor)</th>
      <th>Mô tả & Quy tắc nghiệp vụ (Business Rules)</th>
      <th>Ánh xạ Kỹ thuật / API</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>3.1</b></td>
      <td>Hướng dẫn 5 bước (MediaPipe)</td>
      <td>Nhân viên</td>
      <td>Client hướng dẫn chụp 5 tư thế khuôn mặt (chính diện, nghiêng trái, nghiêng phải, ngửa, cúi). Kiểm tra góc xoay (Yaw/Pitch/Roll) trực tiếp tại trình duyệt bằng MediaPipe Face Mesh.</td>
      <td>
        <code>hooks/use-ekyc-flow.ts</code><br>
        <code>POST /api/v1/cv/validate-frame</code>
      </td>
    </tr>
    <tr>
      <td><b>3.2</b></td>
      <td>Kiểm tra Liveness & Đổi người</td>
      <td>Hệ thống AI</td>
      <td>Phân tích phổ tần số FFT & Texture spectrum nhằm chống giả mạo bằng ảnh in hoặc màn hình điện thoại (Anti-spoofing). Đối sánh khoảng cách embedding giữa các khung hình để phát hiện đổi người trong phiên.</td>
      <td>
        <code>POST /api/v1/cv/enroll</code><br>
        (Dịch vụ Python CV Service)
      </td>
    </tr>
    <tr>
      <td><b>3.3</b></td>
      <td>Lưu vector 128D vào face_data</td>
      <td>Hệ thống</td>
      <td>Trích xuất vector 128 chiều L2-Normalized bằng MobileNetV2/SFace, ghi bản ghi vector vào bảng DB <code>face_data</code> và tải ảnh crop gốc lưu trữ bảo mật trên MinIO.</td>
      <td>
        <code>POST /api/v1/employees/ekyc-enroll</code><br>
        (MinIO bucket: <code>ekyc-faces</code>)
      </td>
    </tr>
  </tbody>
</table>

## 4. Module kiosk: Trạm Kiosk AI

Vận hành điểm chấm công tự động chuyên dụng tại sảnh hoặc cửa ra vào doanh
nghiệp.

<table>
  <thead>
    <tr>
      <th>Mã</th>
      <th>Chức năng</th>
      <th>Tác nhân (Actor)</th>
      <th>Mô tả & Quy tắc nghiệp vụ (Business Rules)</th>
      <th>Ánh xạ Kỹ thuật / API</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>4.1</b></td>
      <td>Xác thực trạm bằng Device Token</td>
      <td>Thiết bị Kiosk</td>
      <td>Xác thực thiết bị phần cứng thông qua mã Device Token riêng biệt, đảm bảo chỉ có trạm được phê duyệt mới được gửi dữ liệu điểm danh.</td>
      <td><code>POST /api/v1/kiosks/register</code></td>
    </tr>
    <tr>
      <td><b>4.2</b></td>
      <td>Nhận diện khuôn mặt (SFace)</td>
      <td>Hệ thống AI</td>
      <td>Bắt luồng khung hình từ camera Kiosk, trích xuất vector khuôn mặt và so khớp với kho vector nhân sự bằng Cosine Similarity trong dưới 500ms; phát hiện tranh chấp ứng viên (AMBIGUOUS_MATCH).</td>
      <td><code>POST /api/v1/cv/recognize</code></td>
    </tr>
    <tr>
      <td><b>4.3</b></td>
      <td>Kiểm tra đi muộn / đúng giờ</td>
      <td>Hệ thống Backend</td>
      <td>Đối chiếu mốc thời gian nhận diện với ca làm việc thực tế được phân; tính toán thời gian ân hạn (Grace Period) để phân loại Đúng giờ, Đi muộn hoặc Về sớm.</td>
      <td><code>POST /api/v1/kiosks/check-in</code></td>
    </tr>
    <tr>
      <td><b>4.4</b></td>
      <td>Lưu snapshot bằng chứng MinIO</td>
      <td>Hệ thống</td>
      <td>Tự động chụp và nén ảnh khung hình tại khoảnh khắc nhận diện thành công hoặc thất bại, đẩy ảnh lên MinIO để phục vụ tra cứu đối soát.</td>
      <td>MinIO bucket: <code>attendance-snapshots</code></td>
    </tr>
  </tbody>
</table>

## 5. Module attendance: Nhật ký Chấm công

Quản lý bản ghi điểm danh, tổng hợp công và hiển thị thống kê chuyên cần thời
gian thực.

<table>
  <thead>
    <tr>
      <th>Mã</th>
      <th>Chức năng</th>
      <th>Tác nhân (Actor)</th>
      <th>Mô tả & Quy tắc nghiệp vụ (Business Rules)</th>
      <th>Ánh xạ Kỹ thuật / API</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>5.1</b></td>
      <td>Xem lịch sử chấm công cá nhân</td>
      <td>Nhân viên</td>
      <td>Xem lại chi tiết thời gian check-in, check-out, số giờ làm việc theo ngày/tháng và ảnh chụp snapshot đối soát của bản thân.</td>
      <td><code>GET /api/v1/attendances/my-history</code></td>
    </tr>
    <tr>
      <td><b>5.2</b></td>
      <td>Xem bảng công toàn doanh nghiệp</td>
      <td>Quản trị viên / HR</td>
      <td>Xem bảng tổng hợp công toàn thể nhân viên; lọc theo khoảng ngày, trạng thái điểm danh (đúng giờ, đi muộn, về sớm, vắng mặt); hỗ trợ đối soát khi có thắc mắc.</td>
      <td><code>GET /api/v1/attendances/records</code></td>
    </tr>
    <tr>
      <td><b>5.3</b></td>
      <td>Thống kê chuyên cần Dashboard</td>
      <td>Quản trị viên / Quản lý</td>
      <td>Biểu đồ trực quan thời gian thực: tỷ lệ nhân viên đã đến, số lượng đi muộn, chưa check-in và số nhân sự đang vắng mặt có phép/không phép.</td>
      <td><code>GET /api/v1/dashboard/overview</code></td>
    </tr>
  </tbody>
</table>

## 6. Module shift: Ca làm & Phân ca

Định nghĩa khung thời gian làm việc và phân bổ lịch trực cho nhân viên.

<table>
  <thead>
    <tr>
      <th>Mã</th>
      <th>Chức năng</th>
      <th>Tác nhân (Actor)</th>
      <th>Mô tả & Quy tắc nghiệp vụ (Business Rules)</th>
      <th>Ánh xạ Kỹ thuật / API</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>6.1</b></td>
      <td>Cấu hình ca (Start/End/Grace)</td>
      <td>Quản trị viên / HR</td>
      <td>Tạo mới ca làm: giờ bắt đầu (Start Time), giờ kết thúc (End Time) và thời gian ân hạn cho phép đi muộn (Grace Period tính theo phút).</td>
      <td>
        <code>POST /api/v1/shifts</code><br>
        <code>GET /api/v1/shifts</code><br>
        <code>PUT /api/v1/shifts/{id}</code>
      </td>
    </tr>
    <tr>
      <td><b>6.2</b></td>
      <td>Phân ca cho nhân viên</td>
      <td>Quản trị viên / HR</td>
      <td>Gán ca làm theo ngày, phân ca hàng loạt theo tuần hoặc sao chép lịch làm việc giữa các tuần (Copy Week Schedule).</td>
      <td>
        <code>POST /api/v1/shifts/assign</code><br>
        <code>POST /api/v1/shifts/bulk-assign</code><br>
        <code>POST /api/v1/shifts/copy-week</code><br>
        <code>GET /api/v1/shifts/schedule</code>
      </td>
    </tr>
  </tbody>
</table>

## 7. Module leave: Quản lý Nghỉ phép

Xử lý luồng nộp đơn, xét duyệt và đồng bộ ngày nghỉ vào hệ thống chấm công.

<table>
  <thead>
    <tr>
      <th>Mã</th>
      <th>Chức năng</th>
      <th>Tác nhân (Actor)</th>
      <th>Mô tả & Quy tắc nghiệp vụ (Business Rules)</th>
      <th>Ánh xạ Kỹ thuật / API</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>7.1</b></td>
      <td>Nhân viên tạo đơn xin nghỉ phép</td>
      <td>Nhân viên</td>
      <td>Chọn loại nghỉ phép (phép năm, nghỉ ốm, việc riêng), khoảng ngày bắt đầu/kết thúc và lý do đính kèm; theo dõi trạng thái đơn (PENDING).</td>
      <td>
        <code>POST /api/v1/leave-requests</code><br>
        <code>GET /api/v1/leave-requests/my-requests</code>
      </td>
    </tr>
    <tr>
      <td><b>7.2</b></td>
      <td>Quản lý duyệt / từ chối đơn</td>
      <td>Cấp Quản lý / HR</td>
      <td>Xem danh sách đơn chờ duyệt; chấp thuận (APPROVED) hoặc từ chối (REJECTED) kèm lý do. Đơn được duyệt tự động cập nhật miễn trừ vi phạm công nhật.</td>
      <td>
        <code>GET /api/v1/leave-requests</code><br>
        <code>PUT /api/v1/leave-requests/{id}/approve</code>
      </td>
    </tr>
  </tbody>
</table>

## 8. Module alert: Cảnh báo Bất thường

Tự động phát hiện nguy cơ gian lận, vi phạm kỷ luật và quy trình tiếp nhận xử lý
giải trình.

<table>
  <thead>
    <tr>
      <th>Mã</th>
      <th>Chức năng</th>
      <th>Tác nhân (Actor)</th>
      <th>Mô tả & Quy tắc nghiệp vụ (Business Rules)</th>
      <th>Ánh xạ Kỹ thuật / API</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>8.1</b></td>
      <td>Tự động gắn cờ cảnh báo giả mạo</td>
      <td>Hệ thống AI</td>
      <td>Tự động sinh cảnh báo mức độ cao khi phát hiện dấu hiệu giả mạo màn hình, ảnh in (SPOOF_DETECTED) trong quá trình chụp eKYC hoặc chấm công Kiosk.</td>
      <td>Sự kiện hệ thống & lưu trữ cảnh báo</td>
    </tr>
    <tr>
      <td><b>8.2</b></td>
      <td>Tự động gắn cờ người lạ / tranh chấp</td>
      <td>Hệ thống AI</td>
      <td>Cảnh báo khi người chấm công không khớp với bất kỳ nhân sự nào trong DB (NO_MATCH) hoặc nhận diện không dứt khoát giữa 2 ứng viên (AMBIGUOUS_MATCH).</td>
      <td>Ghi log cảnh báo Kiosk</td>
    </tr>
    <tr>
      <td><b>8.3</b></td>
      <td>Phát hiện vi phạm (Đi muộn / Về sớm / Vắng mặt)</td>
      <td>Hệ thống Backend</td>
      <td>Tự động đối soát ca trực: gắn cờ khi nhân viên không có bản ghi chấm công (Vắng mặt), check-in sau thời gian ân hạn hoặc check-out trước giờ quy định.</td>
      <td>Scheduled Audit Task</td>
    </tr>
    <tr>
      <td><b>8.4</b></td>
      <td>Đánh dấu trạng thái đã xử lý</td>
      <td>Quản trị viên / HR</td>
      <td>HR kiểm tra ảnh snapshot đối soát, xác nhận đơn giải trình từ nhân viên và chuyển trạng thái cảnh báo sang RESOLVED hoặc DISMISSED.</td>
      <td>
        <code>GET /api/v1/alerts</code><br>
        <code>PUT /api/v1/alerts/{id}/resolve</code>
      </td>
    </tr>
  </tbody>
</table>

## 9. Module monitoring: Giám sát Hệ thống

Quan sát độ sẵn sàng dịch vụ, kiểm soát độ trễ và giám sát tài nguyên máy chủ.

<table>
  <thead>
    <tr>
      <th>Mã</th>
      <th>Chức năng</th>
      <th>Tác nhân (Actor)</th>
      <th>Mô tả & Quy tắc nghiệp vụ (Business Rules)</th>
      <th>Ánh xạ Kỹ thuật / API</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>9.1</b></td>
      <td>Thu thập chỉ số hiệu năng</td>
      <td>Hệ thống</td>
      <td>Thu thập các chỉ số kỹ thuật thông qua Spring Boot Actuator, Python CV Service và Nginx access metrics vào Prometheus (throughput, error rate, active requests).</td>
      <td><code>GET /actuator/prometheus</code></td>
    </tr>
    <tr>
      <td><b>9.2</b></td>
      <td>Giám sát độ trễ & Cam kết chất lượng dịch vụ (SLA)</td>
      <td>Quản trị hệ thống</td>
      <td>Đo lường histogram phân phối độ trễ (P95, P99) của các API nghiệp vụ nhận diện khuôn mặt và chấm công để đảm bảo đáp ứng SLA thời gian thực dưới 1 giây.</td>
      <td>Prometheus SLA Buckets</td>
    </tr>
    <tr>
      <td><b>9.3</b></td>
      <td>Bảng điều khiển tài nguyên máy chủ & JVM</td>
      <td>Quản trị hệ thống</td>
      <td>Trực quan hóa tài nguyên CPU, Memory, Disk I/O, JVM Heap Allocation, Garbage Collection và trạng thái connection pool HikariCP trên Grafana.</td>
      <td>Grafana Dashboard (cổng 80 qua Nginx)</td>
    </tr>
  </tbody>
</table>
