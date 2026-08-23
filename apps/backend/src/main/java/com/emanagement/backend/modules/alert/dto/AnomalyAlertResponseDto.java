package com.emanagement.backend.modules.alert.dto;

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
public class AnomalyAlertResponseDto {
    private Long id;
    private Long userId;
    private String employeeCode;
    private String fullName;
    private String alertType;
    private LocalDate alertDate;
    private String desciption;
    private Boolean isResolved;
    private String resolvedByName;
    private LocalDateTime createdAt;
}
