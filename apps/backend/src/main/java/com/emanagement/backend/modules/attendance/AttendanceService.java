package com.emanagement.backend.modules.attendance;

import java.time.LocalDate;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.attendance.dto.AttendanceHistoryDto;

public interface AttendanceService {
    PageResponse<AttendanceHistoryDto> getUserHistory(Long userId, int page, int size,
            LocalDate startDate, LocalDate endDate, String status);

    PageResponse<AttendanceHistoryDto> getAllRecords(int page, int size,
            LocalDate startDate, LocalDate endDate, String status);
}
