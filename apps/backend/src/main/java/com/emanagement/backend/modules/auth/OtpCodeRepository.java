package com.emanagement.backend.modules.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface OtpCodeRepository extends JpaRepository<OtpCode, Long> {
    Optional<OtpCode> findTopByIdentifierAndTypeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            String identifier, String type, LocalDateTime now);
}
