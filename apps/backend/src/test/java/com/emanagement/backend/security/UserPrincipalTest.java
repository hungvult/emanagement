package com.emanagement.backend.security;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDateTime;
import java.util.Collections;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.emanagement.backend.modules.auth.Role;
import com.emanagement.backend.modules.employee.User;

class UserPrincipalTest {

    private Role role;

    @BeforeEach
    void setUp() {
        role = new Role(1L, "ROLE_EMPLOYEE", null);
    }

    @Test
    @DisplayName("UserPrincipal for ACTIVE user should be enabled and non-locked")
    void testActiveUser() {
        User user = User.builder()
                .id(1L)
                .employeeCode("EMP001")
                .fullName("Nguyen Van A")
                .email("nva@test.com")
                .passwordHash("hash")
                .status("ACTIVE")
                .roles(Collections.singleton(role))
                .build();

        UserPrincipal principal = UserPrincipal.create(user);

        assertTrue(principal.isEnabled());
        assertTrue(principal.isAccountNonLocked());
    }

    @Test
    @DisplayName("UserPrincipal for INACTIVE user should be disabled")
    void testInactiveUser() {
        User user = User.builder()
                .id(2L)
                .employeeCode("EMP002")
                .fullName("Nguyen Van B")
                .email("nvb@test.com")
                .passwordHash("hash")
                .status("INACTIVE")
                .roles(Collections.singleton(role))
                .build();

        UserPrincipal principal = UserPrincipal.create(user);

        assertFalse(principal.isEnabled());
        assertTrue(principal.isAccountNonLocked());
    }

    @Test
    @DisplayName("UserPrincipal for LOCKED status user should be disabled and locked")
    void testLockedStatusUser() {
        User user = User.builder()
                .id(3L)
                .employeeCode("EMP003")
                .fullName("Nguyen Van C")
                .email("nvc@test.com")
                .passwordHash("hash")
                .status("LOCKED")
                .roles(Collections.singleton(role))
                .build();

        UserPrincipal principal = UserPrincipal.create(user);

        assertFalse(principal.isEnabled());
        assertFalse(principal.isAccountNonLocked());
    }

    @Test
    @DisplayName("UserPrincipal for ACTIVE user with active accountLockedUntil should be locked")
    void testTemporarilyLockedUser() {
        User user = User.builder()
                .id(4L)
                .employeeCode("EMP004")
                .fullName("Nguyen Van D")
                .email("nvd@test.com")
                .passwordHash("hash")
                .status("ACTIVE")
                .accountLockedUntil(LocalDateTime.now().plusMinutes(15))
                .roles(Collections.singleton(role))
                .build();

        UserPrincipal principal = UserPrincipal.create(user);

        assertTrue(principal.isEnabled());
        assertFalse(principal.isAccountNonLocked());
    }

    @Test
    @DisplayName("UserPrincipal for ACTIVE user with expired accountLockedUntil should be non-locked")
    void testExpiredLockUser() {
        User user = User.builder()
                .id(5L)
                .employeeCode("EMP005")
                .fullName("Nguyen Van E")
                .email("nve@test.com")
                .passwordHash("hash")
                .status("ACTIVE")
                .accountLockedUntil(LocalDateTime.now().minusMinutes(5))
                .roles(Collections.singleton(role))
                .build();

        UserPrincipal principal = UserPrincipal.create(user);

        assertTrue(principal.isEnabled());
        assertTrue(principal.isAccountNonLocked());
    }
}
