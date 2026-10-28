package com.emanagement.backend.modules.report;

import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import com.emanagement.backend.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class MonthlyReportController {
    private final MonthlyReportService service;

    @GetMapping("/monthly")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<MonthlyReportDto> monthly(@RequestParam int year, @RequestParam int month) {
        return ApiResponse.success(service.getMonthlyReport(year, month));
    }
}
