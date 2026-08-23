package com.emanagement.backend.modules.kiosk.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KioskCheckInResponseDto {
    private Long userId;
    private String employeeCode;
    private String fullName;
    private String checkType;
    private LocalDateTime checkTime;
    private String attendanceStatus;
    private double confidence;
    private String message;
}
