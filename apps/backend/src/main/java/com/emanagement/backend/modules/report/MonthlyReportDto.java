package com.emanagement.backend.modules.report;

import java.time.LocalDateTime;
import java.util.List;

public record MonthlyReportDto(int year, int month, LocalDateTime generatedAt, List<EmployeeRow> employees) {
    public record EmployeeRow(Long userId, String employeeCode, String fullName,
                              long assignedMinutes, long actualMinutes,
                              int earlyCount, int lateCount, int missingCheckoutCount) {}
}
