package com.emanagement.backend.modules.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashSet;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.service.EmailService;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.auth.dto.SendOtpRequest;
import com.emanagement.backend.modules.auth.dto.UpdateProfileRequest;
import com.emanagement.backend.modules.auth.dto.UserProfileDto;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;

@ExtendWith(MockitoExtension.class)
class AuthServiceProfileAndOtpTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private OtpCodeRepository otpCodeRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private StorageService storageService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthServiceImpl authService;

    private User user;

    @BeforeEach
    void setUp() {
        Role role = new Role(1L, "ROLE_USER", "User role");
        user = User.builder()
                .id(1L)
                .employeeCode("EMP001")
                .fullName("Nguyen Van A")
                .email("nva@example.com")
                .phone("0912345678")
                .status("ACTIVE")
                .roles(new HashSet<>(Collections.singletonList(role)))
                .build();
    }

    @Test
    @DisplayName("Cập nhật chỉ Họ tên thành công không cần mã OTP")
    void updateProfile_OnlyFullNameChange_DoesNotRequireOtp() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName("Nguyen Van A Moi");
        request.setEmail("nva@example.com");
        request.setPhone("0912345678");
        request.setOtpCode("");

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileDto result = authService.updateProfile("EMP001", request);

        assertNotNull(result);
        assertEquals("Nguyen Van A Moi", result.getFullName());
        assertEquals("nva@example.com", result.getEmail());
        assertEquals("0912345678", result.getPhone());
        verify(otpCodeRepository, never()).findTopByIdentifierAndTypeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(any(), any(), any());
    }

    @Test
    @DisplayName("Cập nhật Email không có OTP ném BusinessException")
    void updateProfile_EmailChangeWithoutOtp_ThrowsBusinessException() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName("Nguyen Van A");
        request.setEmail("newemail@example.com");
        request.setOtpCode(null);

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> authService.updateProfile("EMP001", request));
        assertTrue(ex.getMessage().contains("Vui lòng cung cấp mã OTP"));
    }

    @Test
    @DisplayName("Cập nhật Email với OTP không chính xác ném BusinessException")
    void updateProfile_EmailChangeWithInvalidOtp_ThrowsBusinessException() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName("Nguyen Van A");
        request.setEmail("newemail@example.com");
        request.setOtpCode("123456");

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));
        when(otpCodeRepository.findTopByIdentifierAndTypeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                eq("newemail@example.com"), eq("UPDATE_PROFILE"), any(LocalDateTime.class)))
                .thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> authService.updateProfile("EMP001", request));
        assertTrue(ex.getMessage().contains("Mã OTP xác thực cập nhật thông tin cá nhân không chính xác"));
    }

    @Test
    @DisplayName("Cập nhật Email với OTP hợp lệ thành công")
    void updateProfile_EmailChangeWithValidOtp_Succeeds() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName("Nguyen Van A");
        request.setEmail("newemail@example.com");
        request.setOtpCode("123456");

        OtpCode validOtp = OtpCode.builder()
                .id(1L)
                .identifier("newemail@example.com")
                .otpCode("123456")
                .type("UPDATE_PROFILE")
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .isUsed(false)
                .build();

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));
        when(otpCodeRepository.findTopByIdentifierAndTypeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                eq("newemail@example.com"), eq("UPDATE_PROFILE"), any(LocalDateTime.class)))
                .thenReturn(Optional.of(validOtp));
        when(userRepository.findByEmail("newemail@example.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileDto result = authService.updateProfile("EMP001", request);

        assertNotNull(result);
        assertEquals("newemail@example.com", result.getEmail());
        assertTrue(validOtp.getIsUsed());
        verify(otpCodeRepository).save(validOtp);
    }

    @Test
    @DisplayName("Gửi OTP khi nhập mã nhân viên (không có @) tự động tra cứu email và gửi OTP")
    void sendOtp_WithEmployeeCode_LooksUpEmailAndSendsOtp() {
        SendOtpRequest request = new SendOtpRequest();
        request.setIdentifier("EMP001");
        request.setType("RESET_PASSWORD");

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));
        when(otpCodeRepository.save(any(OtpCode.class))).thenAnswer(invocation -> invocation.getArgument(0));

        authService.sendOtp(request);

        verify(otpCodeRepository).save(any(OtpCode.class));
        verify(emailService).sendOtpEmail(eq("nva@example.com"), anyString(), eq("RESET_PASSWORD"));
    }

    @Test
    @DisplayName("Cập nhật cả Email và Số điện thoại cùng lúc ném BusinessException")
    void updateProfile_BothEmailAndPhoneChanged_ThrowsBusinessException() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName("Nguyen Van A Moi");
        request.setEmail("newemail@example.com");
        request.setPhone("0987654321");
        request.setOtpCode("123456");

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> authService.updateProfile("EMP001", request));
        assertEquals("Vui lòng cập nhật lần lượt Email hoặc Số điện thoại để đảm bảo xác thực OTP chính xác cho từng kênh liên lạc.", ex.getMessage());
    }

    @Test
    @DisplayName("Cập nhật khi chỉ gửi fullName (email và phone là null) thành công không cần OTP")
    void updateProfile_OnlyFullNameProvided_EmailAndPhoneNull_Succeeds() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName("Nguyen Van A Cap Nhat");
        request.setEmail(null);
        request.setPhone(null);
        request.setOtpCode("");

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileDto result = authService.updateProfile("EMP001", request);

        assertNotNull(result);
        assertEquals("Nguyen Van A Cap Nhat", result.getFullName());
        assertEquals("nva@example.com", result.getEmail());
        assertEquals("0912345678", result.getPhone());
        verify(otpCodeRepository, never()).findTopByIdentifierAndTypeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(any(), any(), any());
    }

    @Test
    @DisplayName("Cập nhật Số điện thoại với OTP hợp lệ thành công")
    void updateProfile_PhoneChangeWithValidOtp_Succeeds() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName("Nguyen Van A");
        request.setPhone("0987654321");
        request.setOtpCode("654321");

        OtpCode validOtp = OtpCode.builder()
                .id(2L)
                .identifier("0987654321")
                .otpCode("654321")
                .type("UPDATE_PROFILE")
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .isUsed(false)
                .build();

        when(userRepository.findByIdentifier("EMP001")).thenReturn(Optional.of(user));
        when(otpCodeRepository.findTopByIdentifierAndTypeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                eq("0987654321"), eq("UPDATE_PROFILE"), any(LocalDateTime.class)))
                .thenReturn(Optional.of(validOtp));
        when(userRepository.findByPhone("0987654321")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileDto result = authService.updateProfile("EMP001", request);

        assertNotNull(result);
        assertEquals("0987654321", result.getPhone());
        assertEquals("nva@example.com", result.getEmail());
        assertTrue(validOtp.getIsUsed());
    }
}
