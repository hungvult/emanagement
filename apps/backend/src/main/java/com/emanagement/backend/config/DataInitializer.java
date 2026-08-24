package com.emanagement.backend.config;

import java.time.LocalTime;
import java.util.Set;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.emanagement.backend.modules.auth.Role;
import com.emanagement.backend.modules.auth.RoleRepository;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.kiosk.Kiosk;
import com.emanagement.backend.modules.kiosk.KioskRepository;
import com.emanagement.backend.modules.shift.Shift;
import com.emanagement.backend.modules.shift.ShiftRepository;
import com.emanagement.backend.security.JwtTokenProvider;

import lombok.RequiredArgsConstructor;

@Component
@Profile("prod")
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final ShiftRepository shiftRepository;
    private final KioskRepository kioskRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public void run(String... args) throws Exception {
        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseGet(() -> roleRepository.save(new Role(null, "ROLE_ADMIN", "Quản lý")));

        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(new Role(null, "ROLE_USER", "Nhân viên")));

        if (userRepository.findByEmail("admin@emanagement.com").isEmpty()) {
            User admin = User.builder()
                    .employeeCode("EMP260001")
                    .fullName("Ngô Văn Dũng Quản Lý")
                    .email("admin@emanagement.com")
                    .phone("0123456789")
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .status("ACTIVE")
                    .roles(Set.of(adminRole))
                    .build();

            userRepository.save(admin);
        }

        if (userRepository.findByEmail("nhanvien@emanagement.com").isEmpty()) {
            User emp = User.builder()
                    .employeeCode("EMP260002")
                    .fullName("Phạm Danh Phố Nhân Viên")
                    .email("nhanvien@emanagement.com")
                    .phone("0987654321")
                    .passwordHash(passwordEncoder.encode("nhanvien123"))
                    .status("ACTIVE")
                    .roles(Set.of(userRole))
                    .build();

            userRepository.save(emp);
        }

        if (shiftRepository.findByShiftCode("SHIFT-001").isEmpty()) {
            Shift shift = Shift.builder()
                    .shiftCode("SHIFT-001")
                    .name("Ca hành chính")
                    .startTime(LocalTime.of(8, 0))
                    .endTime(LocalTime.of(17, 0))
                    .gracePeriodMinutes(15)
                    .build();

            shiftRepository.save(shift);
        }

        if (kioskRepository.findByKioskCode("KSK-2608-001").isEmpty()) {
            String signedToken = jwtTokenProvider.generateKioskDeviceToken("KSK-2608-001",
                    "Trạm Kiosk Demo WebCam Laptop");
            Kiosk kiosk = Kiosk.builder()
                    .kioskCode("KSK-2608-001")
                    .name("Trạm Kiosk Demo WebCam Laptop")
                    .deviceToken(signedToken)
                    .status("ACTIVE")
                    .build();

            kioskRepository.save(kiosk);
        }

        System.out.println("DataInitializer: Nạp dữ liệu mẫu ban đầu thành công.");
    }
}
