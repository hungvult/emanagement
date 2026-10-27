package com.emanagement.backend.modules.dashboard.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.modules.dashboard.dto.DashboardDailyTrendDto;
import com.emanagement.backend.modules.dashboard.dto.DashboardOverviewResponseDto;
import com.emanagement.backend.modules.dashboard.service.DashboardService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@Tag(name = "Dashboard", description = "Các API thống kê tổng quan dành cho Quản lý")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/overview")
    @Operation(
        summary = "Thống kê tổng quan",
        description = "Trả về số liệu tổng quan trong ngày: tổng nhân viên, đi làm, vắng mặt, đi muộn, nghỉ phép"
    )
    public ResponseEntity<ApiResponse<DashboardOverviewResponseDto>> getOverview(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        DashboardOverviewResponseDto data = (date == null)
                ? dashboardService.getOverview()
                : dashboardService.getOverview(date);
        return ResponseEntity.ok(ApiResponse.success("Lấy dữ liệu dashboard thành công", data));
    }

    @GetMapping("/trends")
    @Operation(
        summary = "Thống kê xu hướng chấm công",
        description = "Trả về số liệu xu hướng chấm công theo từng ngày trong khoảng thời gian (mặc định 7 ngày, tối đa 60 ngày)"
    )
    public ResponseEntity<ApiResponse<List<DashboardDailyTrendDto>>> getTrends(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<DashboardDailyTrendDto> data = dashboardService.getTrends(startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success("Lấy dữ liệu xu hướng chấm công thành công", data));
    }
}
