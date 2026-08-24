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
@Schema(description = "Yêu cầu đặt lại mật khẩu mới qua OTP")
public class ResetPasswordRequest {

    @NotBlank(message = "Email hoặc Số điện thoại không được để trống")
    @Pattern(regexp = ValidationPatterns.IDENTIFIER_REGEX, message = "Định dạng phải là Email hợp lệ hoặc Số điện thoại Việt Nam hợp lệ")
    @Schema(description = "Email hoặc Số điện thoại của tài khoản cần đổi mật khẩu", example = "admin@emanagement.com")
    @JsonProperty("identifier")
    private String identifier;

    @NotBlank(message = "Mã OTP không được để trống")
    @Pattern(regexp = ValidationPatterns.OTP_CODE_REGEX, message = "Mã OTP phải gồm đúng 6 chữ số")
    @Schema(description = "Mã OTP 6 số đã nhận qua Email/SMS", example = "123456")
    @JsonProperty("otpCode")
    private String otpCode;

    @NotBlank(message = "Mật khẩu mới không được để trống")
    @Pattern(regexp = ValidationPatterns.PASSWORD_STRONG_REGEX, message = "Mật khẩu mới phải từ 8-64 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt (@#$%^&+=!._-*)")
    @Schema(description = "Mật khẩu mới an toàn chuẩn 2026", example = "NewPass@2026")
    @JsonProperty("newPassword")
    private String newPassword;
}
