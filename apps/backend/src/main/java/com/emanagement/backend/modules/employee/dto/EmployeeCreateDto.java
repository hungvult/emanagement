package com.emanagement.backend.modules.employee.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeCreateDto {
    @NotBlank(message = "Ma nhan vien khong duoc de trong")
    @Size(max = 50, message = "Ma nhan vien toi da 50 ky tu")
    private String employeeCode;

    @NotBlank(message = "Ho ten khong duoc de trong")
    @Size(max = 150, message = "Ho ten toi da 150 ky tu")
    private String fullName;

    @NotBlank(message = "Email khong duoc de trong")
    @Email(message = "Email khong hop le")
    private String email;

    private String phone;

    @NotBlank(message = "Mat khau khong duoc de trong")
    @Size(min = 6, message = "Mat khau toi thieu 6 ky tu")
    private String password;
}
