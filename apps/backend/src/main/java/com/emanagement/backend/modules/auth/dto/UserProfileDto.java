package com.emanagement.backend.modules.auth.dto;

import java.util.Set;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileDto {
    private Long id;
    private String employeeCode;
    private String fullName;
    private String email;
    private String phone;
    private String avatarUrl;
    private Set<String> roles;
}
