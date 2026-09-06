# Biểu đồ phân cấp chức năng (Functional Decomposition Diagram)

Tài liệu phân rã cấu trúc chức năng của hệ thống quản trị chấm công nhận diện
khuôn mặt (eManagement) theo mô hình phân tầng mô-đun (Modular Decomposition).

## 1. Sơ đồ phân rã tổng quan (Level 0 - Level 1)

Sơ đồ thể hiện 6 phân hệ nghiệp vụ chính của hệ thống:

```mermaid
flowchart TD
    Root(["Hệ thống eManagement"])

    Root --> M1["1. Quản lý Nhân sự & eKYC"]
    Root --> M2["2. Quản lý Ca làm việc"]
    Root --> M3["3. Chấm công Khuôn mặt"]
    Root --> M4["4. Quản lý Nghỉ phép"]
    Root --> M5["5. Dashboard & Báo cáo"]
    Root --> M6["6. Cảnh báo Bất thường"]
```

## 2. Chi tiết phân rã từng phân hệ chức năng (Level 1 - Level 3)

### 2.1. Phân hệ Quản lý Nhân sự & eKYC (HR & Identity Management)

```mermaid
flowchart LR
    F1["1. Nhân sự & eKYC"] --> F11["1.1. Hồ sơ nhân viên"]
    F1 --> F12["1.2. Đăng ký eKYC khuôn mặt"]
    F1 --> F13["1.3. Phiên đăng nhập"]

    F11 --> F111["1.1.1. Thêm / sửa / vô hiệu hóa nhân viên"]
    F11 --> F112["1.1.2. Quản lý trạng thái làm việc"]

    F12 --> F121["1.2.1. Chụp ảnh mẫu onboard"]
    F12 --> F122["1.2.2. Trích xuất vector (CV)"]
    F12 --> F123["1.2.3. Lưu trữ ảnh MinIO & vector DB"]
```

### 2.2. Phân hệ Quản lý Ca làm việc (Shift Management)

```mermaid
flowchart LR
    F2["2. Ca làm việc"] --> F21["2.1. Cấu hình ca chuẩn"]
    F2 --> F22["2.2. Phân ca nhân viên"]
    F2 --> F23["2.3. Quy tắc tính công"]

    F21 --> F211["2.1.1. Thiết lập giờ vào / ra"]
    F21 --> F212["2.1.2. Đặt thời gian ân hạn"]

    F22 --> F221["2.2.1. Gán ca cho nhân viên"]
    F22 --> F222["2.2.2. Quản lý thời hạn hiệu lực"]

    F23 --> F231["2.3.1. Tính vi phạm trễ / sớm"]
    F23 --> F232["2.3.2. Tính toán giờ làm tăng ca"]
```

### 2.3. Phân hệ Chấm công Khuôn mặt (AI-based Attendance Tracking)

```mermaid
flowchart LR
    F3["3. Chấm công AI"] --> F31["3.1. Điểm danh Check-in/out"]
    F3 --> F32["3.2. Lịch sử cá nhân"]

    F31 --> F311["3.1.1. Bắt khung hình camera"]
    F31 --> F312["3.1.2. So khớp vector khuôn mặt"]
    F31 --> F313["3.1.3. Ghi timestamp & ảnh chụp"]

    F32 --> F321["3.2.1. Tra cứu nhật ký theo ngày"]
    F32 --> F322["3.2.2. Tổng hợp giờ công tháng"]
```

### 2.4. Phân hệ Quản lý Nghỉ phép (Leave Management)

```mermaid
flowchart LR
    F4["4. Nghỉ phép"] --> F41["4.1. Tạo đơn nghỉ phép"]
    F4 --> F42["4.2. Xét duyệt đơn phép"]
    F4 --> F43["4.3. Quản lý hạn mức nghỉ"]

    F41 --> F411["4.1.1. Chọn loại phép & ngày"]
    F41 --> F412["4.1.2. Nhập lý do nghỉ phép"]

    F42 --> F421["4.2.1. Phê duyệt hoặc từ chối"]
    F42 --> F422["4.2.2. Phản hồi lý do duyệt"]

    F43 --> F431["4.3.1. Kiểm soát ngày phép còn"]
    F43 --> F432["4.3.2. Đồng bộ vào bảng công"]
```

### 2.5. Phân hệ Dashboard & Báo cáo (Dashboard & Reporting)

```mermaid
flowchart LR
    F5["5. Dashboard & Báo cáo"] --> F51["5.1. Dashboard thời gian thực"]
    F5 --> F52["5.2. Xuất báo cáo"]

    F51 --> F511["5.1.1. Thống kê quân số ngày"]
    F51 --> F512["5.1.2. Danh sách trễ & vắng"]

    F52 --> F521["5.2.1. Bộ lọc đa chiều"]
    F52 --> F522["5.2.2. Xuất báo cáo Excel (.xlsx)"]
    F52 --> F523["5.2.3. Xuất tổng hợp công PDF"]
```

### 2.6. Phân hệ Cảnh báo Bất thường (Anomaly Alerting)

```mermaid
flowchart LR
    F6["6. Cảnh báo Bất thường"] --> F61["6.1. Giám sát sai lệch"]
    F6 --> F62["6.2. Xử lý & Phản hồi"]

    F61 --> F611["6.1.1. Quên check-in / check-out"]
    F61 --> F612["6.1.2. Điểm danh sai trạm / thiết bị"]

    F62 --> F621["6.2.1. Kích hoạt thông báo cảnh báo"]
    F62 --> F622["6.2.2. Tiếp nhận & xác nhận giải trình"]
```
