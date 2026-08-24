package com.emanagement.backend.modules.employee.dto;

import com.emanagement.backend.common.validation.ValidationPatterns;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu thêm nhân viên mới do Admin/Quản lý tạo (Mã nhân viên tự động sinh theo chuẩn EMP + Năm + 4 số STT)")
public class EmployeeCreateDto {

    @NotBlank(message = "Họ và tên không được để trống")
    @Size(min = 2, max = 150, message = "Họ và tên từ 2 đến 150 ký tự")
    @Schema(description = "Họ và tên đầy đủ", example = "Nguyễn Văn C")
    private String fullName;

    @Pattern(regexp = ValidationPatterns.EMAIL_REGEX, message = "Định dạng email không hợp lệ (Ví dụ: user@emanagement.com)")
    @Schema(description = "Email (Tùy chọn, nhân viên có thể tự cập nhật sau)", example = "nguyenvanc@gmail.com", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    private String email;

    @Pattern(regexp = ValidationPatterns.PHONE_REGEX, message = "Số điện thoại không hợp lệ (Định dạng 10 số Việt Nam: 0912345678 hoặc +84912345678)")
    @Schema(description = "Số điện thoại (Tùy chọn, nhân viên có thể tự cập nhật sau)", example = "0912345678", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    private String phone;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Pattern(regexp = ValidationPatterns.PASSWORD_STRONG_REGEX, message = "Mật khẩu phải từ 8-64 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt (@#$%^&+=!._-*)")
    @Schema(description = "Mật khẩu khởi tạo tài khoản", example = "Pass@123456")
    private String password;
}
