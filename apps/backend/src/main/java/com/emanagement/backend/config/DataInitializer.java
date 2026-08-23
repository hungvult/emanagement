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

import lombok.RequiredArgsConstructor;

@Component
@Profile("dev")
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final ShiftRepository shiftRepository;
    private final KioskRepository kioskRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseGet(() -> roleRepository.save(new Role(null, "ROLE_ADMIN", "Quan ly")));

        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(new Role(null, "ROLE_USER", "Nhan vien")));

        if (userRepository.findByEmail("admin@emanagement.com").isEmpty()) {
            User admin = User.builder()
                    .employeeCode("NV001")
                    .fullName("Ngo Van Dung Quan Ly")
                    .email("admin@emanagement.com")
                    .phone("0123456789")
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .status("ACTIVE")
                    .roles(Set.of(adminRole))
                    .build();

            userRepository.save(admin);
        }

        if (userRepository.findByEmail("nhanvien@emanagement.com").isEmpty()) {
            User admin = User.builder()
                    .employeeCode("NV002")
                    .fullName("Pham Danh Pho Nhan Vien")
                    .email("nhanvien@emanagement.com")
                    .passwordHash(passwordEncoder.encode("nhanvien123"))
                    .status("ACTIVE")
                    .roles(Set.of(userRole))
                    .build();

            userRepository.save(admin);
        }

        if (shiftRepository.findByShiftCode("OFFICE_HOURS").isEmpty()) {
            Shift shift = Shift.builder()
                    .shiftCode("OFFICE_HOURS")
                    .name("Ca hanh chinh")
                    .startTime(LocalTime.of(8, 0))
                    .endTime(LocalTime.of(17, 0))
                    .gracePeriodMinutes(15)
                    .build();

            shiftRepository.save(shift);
        }

        if (kioskRepository.findByKioskCode("KIOSK_DEMO_LAPTOP_01").isEmpty()) {
            Kiosk kiosk = Kiosk.builder()
                    .kioskCode("KIOSK_DEMO_LAPTOP_01")
                    .name("Tram Kiosk cham cong Demo (WebCam Laptop)")
                    .deviceToken("kiosk_token_demo_laptop_sec_12345")
                    .status("ACTIVE")
                    .build();

            kioskRepository.save(kiosk);
        }

        System.out.println("DataInitializer: Nap du lieu thanh cong");
    }
}
