package com.emanagement.backend.modules.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.modules.auth.dto.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Xác thực & Tài khoản", description = "Các API đăng nhập, OTP và quản lý thông tin tài khoản")
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập hệ thống", description = "Đăng nhập linh hoạt bằng Mã nhân viên (NV001), Email hoặc Số điện thoại kết hợp Mật khẩu")
    public ResponseEntity<ApiResponse<JwtResponse>> authenticateUser(@Valid @RequestBody LoginRequest request) {
        JwtResponse jwtResponse = authService.authenticateUser(request);
        return ResponseEntity.ok(ApiResponse.success("Đăng nhập thành công", jwtResponse));
    }

    @PostMapping("/send-otp")
    @Operation(summary = "Gửi mã OTP", description = "Gửi mã OTP 6 số ngẫu nhiên về Email hoặc Số điện thoại (LOGIN_2FA, RESET_PASSWORD, UPDATE_PROFILE)")
    public ResponseEntity<ApiResponse<Void>> sendOtp(@Valid @RequestBody SendOtpRequest request) {
        authService.sendOtp(request);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi mã OTP xác thực thành công", null));
    }

    @PostMapping("/verify-otp")
    @Operation(summary = "Xác thực mã OTP", description = "Kiểm tra tính hợp lệ của mã OTP")
    public ResponseEntity<ApiResponse<Boolean>> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        boolean isValid = authService.verifyOtp(request);
        if (isValid) {
            return ResponseEntity.ok(ApiResponse.success("Mã OTP hợp lệ", true));
        } else {
            return ResponseEntity.ok(ApiResponse.error("Mã OTP không hợp lệ hoặc đã hết hạn"));
        }
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Đặt lại mật khẩu", description = "Đặt lại mật khẩu mới thông qua mã OTP xác thực")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success("Đổi mật khẩu thành công. Vui lòng đăng nhập lại.", null));
    }

    @GetMapping("/me")
    @Operation(summary = "Thông tin tài khoản hiện tại", description = "Lấy thông tin tài khoản đang đăng nhập từ JWT Token")
    public ResponseEntity<ApiResponse<UserProfileDto>> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String currentIdentifier = authentication.getName();
        UserProfileDto profile = authService.getCurrentUser(currentIdentifier);
        return ResponseEntity.ok(ApiResponse.success(profile));
    }

    @PutMapping("/profile")
    @Operation(summary = "Nhân viên tự cập nhật thông tin cá nhân", description = "Nhân viên cập nhật Email/Số điện thoại chính chủ bằng cách gửi kèm mã OTP xác thực đã nhận")
    public ResponseEntity<ApiResponse<UserProfileDto>> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String currentIdentifier = authentication.getName();
        UserProfileDto profile = authService.updateProfile(currentIdentifier, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thông tin cá nhân thành công", profile));
    }
}
