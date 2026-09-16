package com.emanagement.backend.modules.dashboard.dto;

import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Số liệu thống kê tổng quan thời gian thực cho Quản trị viên")
public class DashboardStatsDto {
    @Schema(description = "Tổng số nhân viên trong hệ thống", example = "50")
    private long totalEmployees;

    @Schema(description = "Số lượng nhân viên đang hoạt động (ACTIVE)", example = "48")
    private long activeEmployees;

    @Schema(description = "Tổng số lượt đã check-in trong ngày hôm nay", example = "42")
    private long todayCheckIns;

    @Schema(description = "Số lượt chấm công đúng giờ trong ngày hôm nay", example = "38")
    private long todayOnTime;

    @Schema(description = "Số lượt chấm công đi muộn trong ngày hôm nay", example = "4")
    private long todayLate;

    @Schema(description = "Số lượng đơn xin nghỉ phép đang chờ duyệt (PENDING)", example = "3")
    private long pendingLeaveRequests;

    @Schema(description = "Số lượng cảnh báo bất thường AI chưa được xử lý", example = "1")
    private long unresolvedAlerts;

    @Schema(description = "Số lượng trạm Kiosk đang ở trạng thái ACTIVE", example = "2")
    private long activeKiosks;

    @Schema(description = "Ngày thống kê", example = "2026-09-16")
    private LocalDate reportDate;
}
