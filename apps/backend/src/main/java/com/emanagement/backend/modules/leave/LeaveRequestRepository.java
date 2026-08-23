package com.emanagement.backend.modules.leave;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {
    List<LeaveRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    Page<LeaveRequest> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
}
