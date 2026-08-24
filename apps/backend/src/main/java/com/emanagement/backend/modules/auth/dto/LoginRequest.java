package com.emanagement.backend.modules.auth.dto;

import com.emanagement.backend.common.validation.ValidationPatterns;
import com.fasterxml.jackson.annotation.JsonProperty;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu đăng nhập hệ thống")
public class LoginRequest {

    @NotBlank(message = "Email hoặc Số điện thoại không được để trống")
    @Pattern(regexp = ValidationPatterns.IDENTIFIER_REGEX, message = "Định dạng đăng nhập phải là Email hợp lệ hoặc Số điện thoại Việt Nam hợp lệ")
    @Schema(description = "Email hoặc Số điện thoại của tài khoản", example = "admin@emanagement.com")
    @JsonProperty("identifier")
    private String identifier;

    @NotBlank(message = "Mật khẩu không được để trống")
    @Schema(description = "Mật khẩu đăng nhập", example = "admin123")
    @JsonProperty("password")
    private String password;

    @Pattern(regexp = ValidationPatterns.OTP_CODE_REGEX, message = "Mã OTP phải đúng 6 chữ số")
    @Schema(description = "Mã OTP 6 số (Không bắt buộc khi đăng nhập thường, chỉ gửi khi bật 2FA)", example = "123456", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    @JsonProperty("otpCode")
    private String otpCode;
}
