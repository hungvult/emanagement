package com.emanagement.backend.modules.shift.dto;

import java.time.LocalDate;

public record ScheduleLeaveDto(Long userId, LocalDate startDate, LocalDate endDate) {
}
