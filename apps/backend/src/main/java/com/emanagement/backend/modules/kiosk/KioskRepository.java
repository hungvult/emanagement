package com.emanagement.backend.modules.kiosk;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface KioskRepository extends JpaRepository<Kiosk, Long> {
    Optional<Kiosk> findByKioskCode(String kioskCode);

    Optional<Kiosk> findByDeviceToken(String deviceToken);
}
