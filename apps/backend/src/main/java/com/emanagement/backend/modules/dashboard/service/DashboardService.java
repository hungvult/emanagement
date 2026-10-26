package com.emanagement.backend.modules.dashboard.service;

import java.time.LocalDate;
import java.util.List;

import com.emanagement.backend.modules.dashboard.dto.DashboardDailyTrendDto;
import com.emanagement.backend.modules.dashboard.dto.DashboardOverviewResponseDto;

public interface DashboardService {
    DashboardOverviewResponseDto getOverview();

    DashboardOverviewResponseDto getOverview(LocalDate targetDate);

    List<DashboardDailyTrendDto> getTrends(LocalDate startDate, LocalDate endDate);
}
