package com.emanagement.backend.modules.leave.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveRequestResponseDto {
    private Long id;
    private Long userId;
    private String employeeCode;
    private String fullName;
    private LocalDate startDate;
    private LocalDate endDate;
    private String reason;
    private String status;
    private String approvedByName;
    private LocalDateTime createdAt;
}
