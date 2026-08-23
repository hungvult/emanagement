package com.emanagement.backend.modules.employee.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeUpdateDto {
    @NotBlank(message = "Ho ten khong duoc de trong")
    private String fullName;
    private String phone;
    private String status;
}
