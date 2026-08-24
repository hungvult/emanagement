package com.emanagement.backend.modules.leave.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Thông tin đơn xin nghỉ phép của nhân viên")
public class LeaveRequestResponseDto {

    @Schema(description = "ID đơn nghỉ phép", example = "1")
    private Long id;

    @Schema(description = "ID nhân viên tạo đơn", example = "1")
    private Long userId;

    @Schema(description = "Mã nhân viên", example = "EMP260001")
    private String employeeCode;

    @Schema(description = "Họ và tên nhân viên", example = "Nguyễn Văn C")
    private String fullName;

    @Schema(description = "Ngày bắt đầu nghỉ", example = "2026-08-25")
    private LocalDate startDate;

    @Schema(description = "Ngày kết thúc nghỉ", example = "2026-08-26")
    private LocalDate endDate;

    @Schema(description = "Lý do xin nghỉ", example = "Nghỉ phép cá nhân giải quyết việc gia đình")
    private String reason;

    @Schema(description = "Trạng thái đơn: PENDING (Chờ duyệt), APPROVED (Đã duyệt), REJECTED (Từ chối)", example = "APPROVED")
    private String status;

    @Schema(description = "Họ tên người duyệt", example = "Ngô Văn Dũng Quản Lý")
    private String approvedByName;

    @Schema(description = "Thời điểm gửi đơn", example = "2026-08-24T09:00:00")
    private LocalDateTime createdAt;
}
