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
@Schema(description = "Yêu cầu kiểm tra tính hợp lệ của mã OTP")
public class VerifyOtpRequest {

    @NotBlank(message = "Email hoặc Số điện thoại không được để trống")
    @Pattern(regexp = ValidationPatterns.IDENTIFIER_REGEX, message = "Định dạng phải là Email hợp lệ hoặc Số điện thoại Việt Nam hợp lệ")
    @Schema(description = "Email hoặc Số điện thoại đã nhận mã OTP", example = "admin@emanagement.com")
    @JsonProperty("identifier")
    private String identifier;

    @NotBlank(message = "Mã OTP không được để trống")
    @Pattern(regexp = ValidationPatterns.OTP_CODE_REGEX, message = "Mã OTP phải gồm đúng 6 chữ số")
    @Schema(description = "Mã OTP 6 số người dùng nhập", example = "123456")
    @JsonProperty("otpCode")
    private String otpCode;

    @NotBlank(message = "Loại OTP không được để trống")
    @Pattern(regexp = ValidationPatterns.OTP_TYPE_REGEX, message = "Loại OTP không hợp lệ (LOGIN_2FA, VERIFY_EMAIL, VERIFY_PHONE, RESET_PASSWORD)")
    @Schema(description = "Mục đích xác thực mã OTP", example = "RESET_PASSWORD")
    @JsonProperty("type")
    private String type;
}
