package com.emanagement.backend.modules.attendance;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long> {
    List<AttendanceRecord> findByUserIdAndCheckInTimeBetween(Long userId, LocalDateTime start, LocalDateTime and);

    Page<AttendanceRecord> findByUserIdOrderByCheckInTimeDesc(Long userId, Pageable pageable);

    // Số nhân viên đã check-in trong khoảng [start, end)
    @Query("""
        select count(distinct a.user.id)
        from AttendanceRecord a
        where a.checkInTime >= :start
          and a.checkInTime < :end
    """)
    long countDistinctPresentUsers(@Param("start") LocalDateTime start,
                                   @Param("end") LocalDateTime end);

    // Số nhân viên đi muộn: check-in đầu tiên trong ngày sau giờ quy định
    @Query("""
        select count(distinct a.user.id)
        from AttendanceRecord a
        where a.checkInTime >= :start
          and a.checkInTime < :end
          and a.user.id not in (
              select a2.user.id from AttendanceRecord a2
              where a2.checkInTime >= :start
                and a2.checkInTime <= :lateThreshold
          )
    """)
    long countDistinctLateUsers(@Param("start") LocalDateTime start,
                                @Param("end") LocalDateTime end,
                                @Param("lateThreshold") LocalDateTime lateThreshold);
}
