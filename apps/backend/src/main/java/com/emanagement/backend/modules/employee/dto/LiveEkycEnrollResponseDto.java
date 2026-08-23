package com.emanagement.backend.modules.employee.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveEkycEnrollResponseDto {
    private Long userId;
    private String employeeCode;
    private int vectorCounterSaved;
    private String message;
}
