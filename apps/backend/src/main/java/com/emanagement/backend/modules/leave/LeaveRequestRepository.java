package com.emanagement.backend.modules.leave;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {
    List<LeaveRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    Page<LeaveRequest> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    long countByStatus(String status);

    // Đếm số đơn nghỉ phép đã APPROVED mà bao gồm ngày hôm nay
    @Query("""
        select count(l)
        from LeaveRequest l
        where l.status = :status
          and l.startDate <= :date
          and l.endDate >= :date
    """)
    long countApprovedLeaveOnDate(@Param("status") String status,
                                  @Param("date") LocalDate date);

    // Các đơn nghỉ APPROVED của nhóm nhân viên có giao với khoảng [start, end]
    @Query("""
        select l from LeaveRequest l
        where l.status = 'APPROVED'
          and l.user.id in :userIds
          and l.startDate <= :end
          and l.endDate >= :start
    """)
    List<LeaveRequest> findApprovedOverlapping(@Param("userIds") java.util.Collection<Long> userIds,
                                               @Param("start") LocalDate start,
                                               @Param("end") LocalDate end);
}
