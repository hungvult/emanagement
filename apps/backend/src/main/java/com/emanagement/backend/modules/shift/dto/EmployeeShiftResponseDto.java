package com.emanagement.backend.modules.shift.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeShiftResponseDto {
    private Long id;
    private Long userId;
    private String employeeCode;
    private String fullName;
    private Long shiftId;
    private String shiftName;
    private String shiftCode;
    private LocalTime startTime;
    private LocalTime endTime;
    private LocalDate assignedDate;
}
