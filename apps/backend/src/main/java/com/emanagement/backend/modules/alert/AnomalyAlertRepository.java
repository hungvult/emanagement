package com.emanagement.backend.modules.alert;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnomalyAlertRepository extends JpaRepository<AnomalyAlert, Long> {
    Page<AnomalyAlert> findByIsResolvedOrderByCreatedAtDesc(Boolean isResolved, Pageable pageable);
}
