package com.emanagement.backend.modules.employee.dto;

import com.emanagement.backend.common.validation.ValidationPatterns;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeUpdateDto {

    @NotBlank(message = "Họ và tên không được để trống")
    @Size(min = 2, max = 150, message = "Họ và tên từ 2 đến 150 ký tự")
    private String fullName;

    @Pattern(regexp = ValidationPatterns.PHONE_REGEX, message = "Số điện thoại không hợp lệ (Định dạng 10 số Việt Nam: 0912345678)")
    private String phone;

    @Pattern(regexp = ValidationPatterns.USER_STATUS_REGEX, message = "Trạng thái nhân viên chỉ chấp nhận ACTIVE hoặc INACTIVE")
    private String status;
}
