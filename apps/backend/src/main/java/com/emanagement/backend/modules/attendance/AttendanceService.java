package com.emanagement.backend.modules.attendance;

import java.io.IOException;
import java.io.OutputStream;
import java.time.LocalDate;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.attendance.dto.AttendanceHistoryDto;
import com.emanagement.backend.modules.attendance.dto.ManualAttendanceRequestDto;

public interface AttendanceService {
    PageResponse<AttendanceHistoryDto> getUserHistory(Long userId, int page, int size,
            LocalDate startDate, LocalDate endDate, String status, Long shiftId);

    PageResponse<AttendanceHistoryDto> getAllRecords(int page, int size,
            LocalDate startDate, LocalDate endDate, String status, Long shiftId);

    PageResponse<AttendanceHistoryDto> getAllRecords(int page, int size,
            LocalDate startDate, LocalDate endDate, String status, Long shiftId, String search);

    AttendanceHistoryDto createManualRecord(ManualAttendanceRequestDto dto);

    AttendanceHistoryDto updateManualRecord(Long id, ManualAttendanceRequestDto dto);

    void exportAttendanceToCsv(OutputStream outputStream, LocalDate startDate, LocalDate endDate,
            String status, Long shiftId, String search) throws IOException;
}

