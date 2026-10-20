package com.emanagement.backend.modules.employee;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.Collections;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.emanagement.backend.common.service.EmailService;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.auth.RefreshTokenRepository;
import com.emanagement.backend.modules.auth.Role;
import com.emanagement.backend.modules.auth.RoleRepository;
import com.emanagement.backend.modules.employee.dto.EmployeeResponseDto;
import com.emanagement.backend.modules.employee.dto.EmployeeUpdateDto;
import com.emanagement.backend.modules.face.AiFaceService;
import com.emanagement.backend.modules.face.FaceDataRepository;

@ExtendWith(MockitoExtension.class)
class EmployeeServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private EmailService emailService;

    @Mock
    private StorageService storageService;

    @Mock
    private FaceDataRepository faceDataRepository;

    @Mock
    private AiFaceService aiFaceService;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    private EmployeeServiceImpl employeeService;

    private User user;

    @BeforeEach
    void setUp() {
        Role employeeRole = new Role(1L, "ROLE_EMPLOYEE", null);
        user = User.builder()
                .id(10L)
                .employeeCode("EMP010")
                .fullName("Tran Van B")
                .email("tvb@emanagement.com")
                .phone("0987654321")
                .status("ACTIVE")
                .roles(Collections.singleton(employeeRole))
                .build();
    }

    @Test
    @DisplayName("updateEmployee should revoke all refresh tokens when status is changed to INACTIVE")
    void testUpdateEmployee_SetInactive_RevokesRefreshTokens() {
        EmployeeUpdateDto dto = new EmployeeUpdateDto("Tran Van B", "0987654321", "INACTIVE");

        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EmployeeResponseDto result = employeeService.updateEmployee(10L, dto);

        assertEquals("INACTIVE", result.getStatus());
        verify(refreshTokenRepository, times(1)).revokeAllByUserId(10L);
    }

    @Test
    @DisplayName("updateEmployee should NOT revoke refresh tokens when status remains ACTIVE")
    void testUpdateEmployee_KeepActive_DoesNotRevokeRefreshTokens() {
        EmployeeUpdateDto dto = new EmployeeUpdateDto("Tran Van B Updated", "0987654321", "ACTIVE");

        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EmployeeResponseDto result = employeeService.updateEmployee(10L, dto);

        assertEquals("ACTIVE", result.getStatus());
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
    }

    @Test
    @DisplayName("deleteEmployee: Xóa cả avatar và eKYC photos trên MinIO khi nhân viên có avatar")
    void deleteEmployee_WithAvatar_DeletesAvatarAndFacesAndUser() {
        user.setAvatarUrl("avatars/2026/10/20/avatar_EMP010.jpg");
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(faceDataRepository.findByUserId(10L)).thenReturn(Collections.emptyList());

        employeeService.deleteEmployee(10L);

        verify(storageService, times(1)).deleteImageByUrl("avatars/2026/10/20/avatar_EMP010.jpg");
        verify(userRepository, times(1)).delete(user);
    }

    @Test
    @DisplayName("deleteEmployee: Khi MinIO lỗi khi xóa avatar thì vẫn xóa user và không ném Exception")
    void deleteEmployee_AvatarDeletionThrows_ContinuesAndDeletesUser() {
        user.setAvatarUrl("avatars/2026/10/20/avatar_EMP010.jpg");
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(faceDataRepository.findByUserId(10L)).thenReturn(Collections.emptyList());
        doThrow(new RuntimeException("MinIO connection timed out")).when(storageService).deleteImageByUrl(anyString());

        assertDoesNotThrow(() -> employeeService.deleteEmployee(10L));

        verify(storageService, times(1)).deleteImageByUrl("avatars/2026/10/20/avatar_EMP010.jpg");
        verify(userRepository, times(1)).delete(user);
    }

    @Test
    @DisplayName("deleteEmployee: Không có avatar thì không gọi storageService xóa avatar")
    void deleteEmployee_NoAvatar_DoesNotCallDeleteImageByUrl() {
        user.setAvatarUrl(null);
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(faceDataRepository.findByUserId(10L)).thenReturn(Collections.emptyList());

        employeeService.deleteEmployee(10L);

        verify(storageService, never()).deleteImageByUrl(anyString());
        verify(userRepository, times(1)).delete(user);
    }

    @Test
    @DisplayName("deleteEmployee: Avatar là chuỗi trắng (blank) thì không gọi storageService xóa avatar")
    void deleteEmployee_BlankAvatar_DoesNotCallDeleteImageByUrl() {
        user.setAvatarUrl("   ");
        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(faceDataRepository.findByUserId(10L)).thenReturn(Collections.emptyList());

        employeeService.deleteEmployee(10L);

        verify(storageService, never()).deleteImageByUrl(anyString());
        verify(userRepository, times(1)).delete(user);
    }
}

