package com.emanagement.backend.modules.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.modules.employee.User;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    private RefreshTokenServiceImpl refreshTokenService;

    private User testUser;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(refreshTokenService, "refreshExpirationMs", 604800000L);

        testUser = User.builder()
                .id(1L)
                .employeeCode("NV001")
                .fullName("Nguyen Van A")
                .email("test@emanagement.com")
                .build();
    }

    @Test
    @DisplayName("createRefreshToken should generate raw token and persist SHA-256 hashed token")
    void testCreateRefreshToken() {
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String rawToken = refreshTokenService.createRefreshToken(testUser);

        assertNotNull(rawToken);
        assertFalse(rawToken.isBlank());

        verify(refreshTokenRepository, times(1)).save(argThat(token -> 
            token.getUser().equals(testUser) &&
            token.getTokenHash() != null &&
            token.getTokenHash().length() == 64 &&
            !token.isRevoked() &&
            token.getExpiryDate().isAfter(LocalDateTime.now())
        ));
    }

    @Test
    @DisplayName("verifyAndGet should return RefreshToken when token is valid")
    void testVerifyAndGet_Valid() {
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(invocation -> invocation.getArgument(0));
        String rawToken = refreshTokenService.createRefreshToken(testUser);

        RefreshToken savedToken = RefreshToken.builder()
                .id(10L)
                .user(testUser)
                .tokenHash("somehash")
                .expiryDate(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(savedToken));

        RefreshToken result = refreshTokenService.verifyAndGet(rawToken);

        assertNotNull(result);
        assertEquals(10L, result.getId());
        assertFalse(result.isRevoked());
    }

    @Test
    @DisplayName("verifyAndGet should detect replay attack on revoked token and revoke all user tokens")
    void testVerifyAndGet_ReplayAttackDetected() {
        RefreshToken revokedToken = RefreshToken.builder()
                .id(20L)
                .user(testUser)
                .tokenHash("somehash")
                .expiryDate(LocalDateTime.now().plusDays(5))
                .revoked(true)
                .build();

        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(revokedToken));

        BusinessException exception = assertThrows(BusinessException.class, () -> {
            refreshTokenService.verifyAndGet("raw-stolen-token");
        });

        assertTrue(exception.getMessage().contains("Phiên làm việc không an toàn"));
        verify(refreshTokenRepository, times(1)).revokeAllByUserId(testUser.getId());
    }

    @Test
    @DisplayName("verifyAndGet should mark expired token as revoked and throw BusinessException")
    void testVerifyAndGet_ExpiredToken() {
        RefreshToken expiredToken = RefreshToken.builder()
                .id(30L)
                .user(testUser)
                .tokenHash("somehash")
                .expiryDate(LocalDateTime.now().minusHours(1))
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(expiredToken));

        BusinessException exception = assertThrows(BusinessException.class, () -> {
            refreshTokenService.verifyAndGet("raw-expired-token");
        });

        assertTrue(exception.getMessage().contains("hết hạn"));
        assertTrue(expiredToken.isRevoked());
        verify(refreshTokenRepository, times(1)).save(expiredToken);
    }

    @Test
    @DisplayName("verifyAndGet should throw ResourceNotFoundException for unknown token")
    void testVerifyAndGet_NotFound() {
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> {
            refreshTokenService.verifyAndGet("unknown-token");
        });
    }

    @Test
    @DisplayName("rotateRefreshToken should revoke existing token and generate new token")
    void testRotateRefreshToken() {
        RefreshToken existingToken = RefreshToken.builder()
                .id(40L)
                .user(testUser)
                .tokenHash("oldhash")
                .expiryDate(LocalDateTime.now().plusDays(3))
                .revoked(false)
                .build();

        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String newRawToken = refreshTokenService.rotateRefreshToken(existingToken);

        assertNotNull(newRawToken);
        assertTrue(existingToken.isRevoked());
        verify(refreshTokenRepository, atLeast(2)).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("revokeToken should set revoked to true for found token")
    void testRevokeToken() {
        RefreshToken token = RefreshToken.builder()
                .id(50L)
                .user(testUser)
                .tokenHash("hashToRevoke")
                .expiryDate(LocalDateTime.now().plusDays(2))
                .revoked(false)
                .build();

        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));

        refreshTokenService.revokeToken("raw-token-to-revoke");

        assertTrue(token.isRevoked());
        verify(refreshTokenRepository, times(1)).save(token);
    }
}
