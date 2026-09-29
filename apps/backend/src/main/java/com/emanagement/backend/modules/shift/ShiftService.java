package com.emanagement.backend.modules.shift;

import java.time.LocalDate;
import java.util.List;

import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.EmployeeShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;

public interface ShiftService {
    ShiftResponseDto createShift(ShiftCreateDto dto);

    List<ShiftResponseDto> getAllShifts();

    void assignShift(AssignShiftDto dto);

    List<EmployeeShiftResponseDto> getSchedule(LocalDate startDate, LocalDate endDate);
    List<EmployeeShiftResponseDto> getMySchedule(Long userId, LocalDate startDate, LocalDate endDate);
}
