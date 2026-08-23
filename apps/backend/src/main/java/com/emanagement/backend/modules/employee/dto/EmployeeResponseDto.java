package com.emanagement.backend.modules.employee.dto;

import java.time.LocalDateTime;
import java.util.Set;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeResponseDto {
    private Long id;
    private String employeeCode;
    private String fullName;
    private String email;
    private String phone;
    private String avatarUrl;
    private String status;
    private Set<String> roles;
    private boolean hasRegisteredFace;
    private LocalDateTime createAt;
}
