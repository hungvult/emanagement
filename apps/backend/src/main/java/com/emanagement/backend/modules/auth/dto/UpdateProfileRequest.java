package com.emanagement.backend.modules.auth.dto;

import com.emanagement.backend.common.validation.ValidationPatterns;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.swagger.v3.oas.annotations.media.Schema;
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
@Schema(description = "Yêu cầu nhân viên tự cập nhật thông tin cá nhân kèm mã OTP xác thực")
public class UpdateProfileRequest {

    @NotBlank(message = "Họ và tên không được để trống")
    @Size(min = 2, max = 150, message = "Họ và tên từ 2 đến 150 ký tự")
    @Schema(description = "Họ và tên mới", example = "Trần Văn Nhân Viên")
    private String fullName;

    @Pattern(regexp = ValidationPatterns.EMAIL_REGEX, message = "Định dạng email không hợp lệ")
    @Schema(description = "Email mới của nhân viên", example = "nhanvien01@gmail.com")
    private String email;

    @Pattern(regexp = ValidationPatterns.PHONE_REGEX, message = "Số điện thoại không hợp lệ (10 số)")
    @Schema(description = "Số điện thoại mới của nhân viên", example = "0912345678")
    private String phone;

    @NotBlank(message = "Mã OTP xác thực không được để trống")
    @Pattern(regexp = ValidationPatterns.OTP_CODE_REGEX, message = "Mã OTP phải gồm đúng 6 chữ số")
    @Schema(description = "Mã OTP 6 số đã gửi về Email hoặc Phone mới để xác thực", example = "123456")
    @JsonProperty("otpCode")
    private String otpCode;
}
