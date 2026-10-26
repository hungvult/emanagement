package com.emanagement.backend.modules.dashboard.dto;

import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardDailyTrendDto {
    private LocalDate date;
    private long totalEmployees;
    private long presentCount;
    private long onTimeCount;
    private long lateCount;
    private long absentCount;
    private long onLeaveCount;
}
