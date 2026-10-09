package com.emanagement.backend.modules.dashboard.controlller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.modules.dashboard.dto.DashboardOverviewResponseDto;
import com.emanagement.backend.modules.dashboard.service.DashboardService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Các API thống kê tổng quan dành cho Quản lý")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/overview")
    @Operation(
        summary = "Thống kê tổng quan",
        description = "Trả về số liệu tổng quan trong ngày: tổng nhân viên, đi làm, vắng mặt, đi muộn, nghỉ phép"
    )
    public ResponseEntity<ApiResponse<DashboardOverviewResponseDto>> getOverview() {
        DashboardOverviewResponseDto data = dashboardService.getOverview();
        return ResponseEntity.ok(ApiResponse.success("Lấy dữ liệu dashboard thành công", data));
    }
}
