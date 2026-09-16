package com.emanagement.backend.modules.shift;

import java.util.List;

import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;

public interface ShiftService {
    ShiftResponseDto createShift(ShiftCreateDto dto);

    List<ShiftResponseDto> getAllShifts();

    void assignShift(AssignShiftDto dto);

    List<com.emanagement.backend.modules.shift.dto.EmployeeScheduleDto> getMySchedule(Long userId, java.time.LocalDate from, java.time.LocalDate to);
}
