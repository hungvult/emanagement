package com.emanagement.backend.modules.dashboard.service;

import com.emanagement.backend.modules.dashboard.dto.DashboardOverviewResponseDto;

public interface DashboardService {
    DashboardOverviewResponseDto getOverview();
}
