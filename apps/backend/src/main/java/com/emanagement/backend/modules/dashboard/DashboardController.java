package com.emanagement.backend.modules.dashboard;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.modules.dashboard.dto.DashboardStatsDto;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@Tag(name = "Bảng Điều Khiển Tổng Quan (Dashboard)", description = "Các API thống kê số liệu tổng quan thời gian thực dành cho Admin/Quản lý")
public class DashboardController {
    private final DashboardService dashboardService;

    @GetMapping("/stats")
    @Operation(summary = "Thống kê tổng quan thời gian thực", description = "Cung cấp các chỉ số quan trọng: quân số, số lượt vào ca hôm nay, đi muộn, đơn chờ duyệt và cảnh báo AI")
    public ResponseEntity<ApiResponse<DashboardStatsDto>> getDashboardStats() {
        DashboardStatsDto stats = dashboardService.getDashboardStats();
        return ResponseEntity.ok(ApiResponse.success(stats));
    }
}
