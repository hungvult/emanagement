package com.emanagement.backend.modules.attendance;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long> {
    List<AttendanceRecord> findByUserIdAndCheckInTimeBetween(Long userId, LocalDateTime start, LocalDateTime and);

    Page<AttendanceRecord> findByUserIdOrderByCheckInTimeDesc(Long userId, Pageable pageable);
}
