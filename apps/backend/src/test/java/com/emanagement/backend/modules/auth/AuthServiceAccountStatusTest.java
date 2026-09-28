package com.emanagement.backend.modules.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.auth.dto.LoginRequest;
import com.emanagement.backend.modules.auth.dto.ResetPasswordRequest;
import com.emanagement.backend.modules.auth.dto.SendOtpRequest;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.common.service.EmailService;
import com.emanagement.backend.security.JwtTokenProvider;

@ExtendWith(MockitoExtension.class)
class AuthServiceAccountStatusTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private OtpCodeRepository otpCodeRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private StorageService storageService;

    @InjectMocks
    private AuthServiceImpl authService;

    private User user;

    @BeforeEach
    void setUp() {
        Role employeeRole = new Role(1L, "ROLE_EMPLOYEE", null);

        user = User.builder()
                .id(1L)
                .employeeCode("EMP001")
                .fullName("Nguyen Van A")
                .email("nva@emanagement.com")
                .phone("0901234567")
                .passwordHash("$2a$10$hashedpassword")
                .status("ACTIVE")
                .failedLoginAttempts(0)
                .roles(Collections.singleton(employeeRole))
                .build();
    }

    @ParameterizedTest
    @ValueSource(strings = {"INACTIVE", "LOCKED", "SUSPENDED", "BANNED"})
    @DisplayName("authenticateUser should reject login when account status is not ACTIVE")
    void testAuthenticateUser_NonActiveStatus_ThrowsBusinessException(String status) {
        user.setStatus(status);
        LoginRequest request = new LoginRequest("EMP001", "password123", null);

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));

        BusinessException ex = assertThrows(BusinessException.class, () -> {
            authService.authenticateUser(request);
        });

        assertTrue(ex.getMessage().contains("bị khóa hoặc ngừng hoạt động"));
        verifyNoInteractions(passwordEncoder);
        verifyNoInteractions(authenticationManager);
    }

    @Test
    @DisplayName("authenticateUser should reject login when account status is null")
    void testAuthenticateUser_NullStatus_ThrowsBusinessException() {
        user.setStatus(null);
        LoginRequest request = new LoginRequest("EMP001", "password123", null);

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));

        BusinessException ex = assertThrows(BusinessException.class, () -> {
            authService.authenticateUser(request);
        });

        assertTrue(ex.getMessage().contains("bị khóa hoặc ngừng hoạt động"));
        verifyNoInteractions(passwordEncoder);
    }

    @Test
    @DisplayName("authenticateUser should reject login when account is temporarily locked due to 5 failed attempts")
    void testAuthenticateUser_TemporarilyLocked_ThrowsBusinessException() {
        user.setAccountLockedUntil(LocalDateTime.now().plusMinutes(15));
        user.setFailedLoginAttempts(5);
        LoginRequest request = new LoginRequest("EMP001", "password123", null);

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));

        BusinessException ex = assertThrows(BusinessException.class, () -> {
            authService.authenticateUser(request);
        });

        assertTrue(ex.getMessage().contains("tạm thời bị khóa do đăng nhập sai"));
        verifyNoInteractions(passwordEncoder);
    }

    @Test
    @DisplayName("authenticateUser should auto-unlock when temporary lock has expired")
    void testAuthenticateUser_ExpiredTemporaryLock_ClearsLock() {
        user.setAccountLockedUntil(LocalDateTime.now().minusMinutes(1));
        user.setFailedLoginAttempts(5);
        LoginRequest request = new LoginRequest("EMP001", "wrong_password", null);

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong_password", user.getPasswordHash())).thenReturn(false);

        // First attempt with wrong password after expired lock
        BusinessException ex = assertThrows(BusinessException.class, () -> {
            authService.authenticateUser(request);
        });

        // Lock was cleared, then wrong password incremented attempt to 1 (remaining 4)
        assertTrue(ex.getMessage().contains("Bạn còn 4 lần thử"));
        verify(userRepository, atLeastOnce()).save(user);
    }

    @Test
    @DisplayName("sendOtp should reject sending OTP for non-ACTIVE user")
    void testSendOtp_NonActiveUser_ThrowsBusinessException() {
        user.setStatus("INACTIVE");
        SendOtpRequest request = new SendOtpRequest("EMP001", "FORGOT_PASSWORD");

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));

        BusinessException ex = assertThrows(BusinessException.class, () -> {
            authService.sendOtp(request);
        });

        assertTrue(ex.getMessage().contains("bị khóa hoặc ngừng hoạt động"));
        verifyNoInteractions(otpCodeRepository);
    }

    @Test
    @DisplayName("resetPassword should reject resetting password for non-ACTIVE user")
    void testResetPassword_NonActiveUser_ThrowsBusinessException() {
        user.setStatus("LOCKED");
        ResetPasswordRequest request = new ResetPasswordRequest("EMP001", "123456", "newPassword123");

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));

        BusinessException ex = assertThrows(BusinessException.class, () -> {
            authService.resetPassword(request);
        });

        assertTrue(ex.getMessage().contains("bị khóa hoặc ngừng hoạt động"));
        verifyNoInteractions(passwordEncoder);
    }
}
