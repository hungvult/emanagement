package com.emanagement.backend.modules.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.Collections;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.modules.auth.dto.RefreshTokenRequest;
import com.emanagement.backend.modules.auth.dto.TokenRefreshResponse;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.security.JwtTokenProvider;

@ExtendWith(MockitoExtension.class)
class AuthServiceRefreshTokenTest {

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @InjectMocks
    private AuthServiceImpl authService;

    private User activeUser;
    private RefreshToken validRefreshToken;

    @BeforeEach
    void setUp() {
        Role employeeRole = new Role(1L, "ROLE_EMPLOYEE", null);

        activeUser = User.builder()
                .id(1L)
                .employeeCode("NV001")
                .fullName("Nguyen Van A")
                .email("nva@emanagement.com")
                .status("ACTIVE")
                .roles(Collections.singleton(employeeRole))
                .build();

        validRefreshToken = RefreshToken.builder()
                .id(100L)
                .user(activeUser)
                .tokenHash("somehash")
                .expiryDate(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .build();
    }

    @Test
    @DisplayName("refreshToken should succeed when user is active and account is not locked")
    void testRefreshToken_Success() {
        RefreshTokenRequest request = new RefreshTokenRequest("raw-refresh-token");
        when(refreshTokenService.verifyAndGet("raw-refresh-token")).thenReturn(validRefreshToken);
        when(jwtTokenProvider.genarateToken(any(Authentication.class))).thenReturn("new-access-token");
        when(refreshTokenService.rotateRefreshToken(validRefreshToken)).thenReturn("new-rotated-refresh-token");

        TokenRefreshResponse response = authService.refreshToken(request);

        assertNotNull(response);
        assertEquals("new-access-token", response.getAccessToken());
        assertEquals("new-rotated-refresh-token", response.getRefreshToken());
        assertEquals("Bearer", response.getTokenType());
    }

    @Test
    @DisplayName("refreshToken should revoke token and throw BusinessException when user is inactive")
    void testRefreshToken_InactiveUser() {
        activeUser.setStatus("INACTIVE");
        RefreshTokenRequest request = new RefreshTokenRequest("raw-refresh-token");
        when(refreshTokenService.verifyAndGet("raw-refresh-token")).thenReturn(validRefreshToken);

        BusinessException ex = assertThrows(BusinessException.class, () -> {
            authService.refreshToken(request);
        });

        assertTrue(ex.getMessage().contains("vô hiệu hóa hoặc không hoạt động"));
        verify(refreshTokenService, times(1)).revokeToken("raw-refresh-token");
        verify(refreshTokenService, never()).rotateRefreshToken(any());
    }

    @Test
    @DisplayName("refreshToken should revoke token and throw BusinessException when user is locked")
    void testRefreshToken_LockedUser() {
        activeUser.setAccountLockedUntil(LocalDateTime.now().plusMinutes(15));
        RefreshTokenRequest request = new RefreshTokenRequest("raw-refresh-token");
        when(refreshTokenService.verifyAndGet("raw-refresh-token")).thenReturn(validRefreshToken);

        BusinessException ex = assertThrows(BusinessException.class, () -> {
            authService.refreshToken(request);
        });

        assertTrue(ex.getMessage().contains("tạm khóa"));
        verify(refreshTokenService, times(1)).revokeToken("raw-refresh-token");
        verify(refreshTokenService, never()).rotateRefreshToken(any());
    }
}
