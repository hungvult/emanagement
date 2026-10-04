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

    boolean existsByUserIdAndCheckInTimeBetween(Long userId, LocalDateTime start, LocalDateTime end);

    List<AttendanceRecord> findByUserIdInAndCheckInTimeBetween(java.util.Collection<Long> userIds,
            LocalDateTime start, LocalDateTime end);

    Page<AttendanceRecord> findByUserIdOrderByCheckInTimeDesc(Long userId, Pageable pageable);

    // Lọc lịch sử chấm công của 1 nhân viên theo ngày, trạng thái và ca
    @Query("""
        select a from AttendanceRecord a
        where a.user.id = :userId
          and (:hasStartDate = false or a.checkInTime >= :startDate)
          and (:hasEndDate = false or a.checkInTime < :endDate)
          and (:hasStatus = false or a.status = :status)
          and (:hasShiftId = false or (a.shift is not null and a.shift.id = :shiftId))
        order by a.checkInTime desc
    """)
    Page<AttendanceRecord> findByUserIdWithFilters(
            @Param("userId") Long userId,
            @Param("hasStartDate") boolean hasStartDate,
            @Param("startDate") LocalDateTime startDate,
            @Param("hasEndDate") boolean hasEndDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("hasStatus") boolean hasStatus,
            @Param("status") String status,
            @Param("hasShiftId") boolean hasShiftId,
            @Param("shiftId") Long shiftId,
            Pageable pageable);

    // Lọc toàn bộ chấm công (Admin) theo ngày, trạng thái và ca
    @Query("""
        select a from AttendanceRecord a
        where (:hasStartDate = false or a.checkInTime >= :startDate)
          and (:hasEndDate = false or a.checkInTime < :endDate)
          and (:hasStatus = false or a.status = :status)
          and (:hasShiftId = false or (a.shift is not null and a.shift.id = :shiftId))
        order by a.checkInTime desc
    """)
    Page<AttendanceRecord> findAllWithFilters(
            @Param("hasStartDate") boolean hasStartDate,
            @Param("startDate") LocalDateTime startDate,
            @Param("hasEndDate") boolean hasEndDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("hasStatus") boolean hasStatus,
            @Param("status") String status,
            @Param("hasShiftId") boolean hasShiftId,
            @Param("shiftId") Long shiftId,
            Pageable pageable);

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
