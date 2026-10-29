# Thông báo trong ứng dụng

Chuông hiển thị 10 mục mới nhất, cập nhật khi mở và mỗi phút. Trang `/notifications` có phân trang, đọc và xóa thông báo. Thông báo chỉ truy cập được bởi người nhận; các liên kết mở chi tiết đơn nghỉ và chấm công vẫn kiểm tra quyền ở backend.

| Sự kiện | Người nhận |
| --- | --- |
| Phân, đổi hoặc hủy ca | Nhân viên liên quan |
| Đơn nghỉ mới | Admin đang hoạt động |
| Duyệt/từ chối đơn nghỉ, kèm ghi chú | Nhân viên gửi đơn |
| Thêm/sửa chấm công thủ công, kèm giờ vào/ra và lý do | Nhân viên liên quan |
| Import hoàn tất hoặc thất bại, kèm số thành công/lỗi | Người thực hiện import |
| Chưa đăng ký khuôn mặt | Nhân viên; hướng dẫn liên hệ admin để đăng ký |
| Nhắc ca sắp bắt đầu | Nhân viên, trước ca 15 phút |
| Chưa chấm công vào | Nhân viên, sau giờ bắt đầu cộng thời gian cho phép trễ |
| Thiếu chấm công ra | Nhân viên và admin, sau giờ kết thúc ca 30 phút |
| Tổng hợp đi muộn, về sớm, thiếu chấm công | Admin, 18:30 hằng ngày |
| Dịch vụ nhận diện lỗi 3 lần kiểm tra liên tiếp hoặc phục hồi | Admin |

Lịch chạy dùng múi giờ `Asia/Ho_Chi_Minh`. Nhắc chấm công chỉ áp dụng cho ngày hiện tại, bỏ qua nhân viên không hoạt động và nghỉ phép đã duyệt. Nhắc trước ca hết hạn lúc ca bắt đầu; nhắc thiếu chấm công hết hạn vào cuối ngày. Khi đã chấm công hoặc lịch bị hủy, lần quét tiếp theo sẽ ẩn nhắc cũ.

Các nhắc và kết quả import có khóa chống gửi trùng; xóa khỏi hộp thư vẫn giữ khóa này để lần chạy tiếp theo không gửi lại. Cảnh báo AI chưa xử lý tiếp tục được hiển thị riêng cho admin và chỉ hết khi xử lý cảnh báo.

Các thuộc tính Spring có thể điều chỉnh:

- `notifications.shift-reminder-minutes`: mặc định `15`.
- `notifications.checkout-wait-minutes`: mặc định `30`.
- `notifications.poll-ms`: mặc định `60000`.
- `notifications.initial-delay-ms`: mặc định `60000`.
- `notifications.daily-summary-cron`: mặc định `0 30 18 * * *`.
- `notifications.health-poll-ms`: mặc định `60000`; kiểm tra `/api/v1/cv/health` tại `ai-service.base-url`.

Theo dõi mất kết nối kiosk riêng lẻ cần bổ sung heartbeat thiết bị; hiện cảnh báo kết nối áp dụng cho dịch vụ nhận diện dùng chung.
