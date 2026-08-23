package com.emanagement.backend.modules.shift.dto;

import java.time.LocalTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShiftResponseDto {
    private Long id;
    private String shiftCode;
    private String name;
    private LocalTime startTime;
    private LocalTime endTime;
    private Integer gracePeriodMinutes;
}
