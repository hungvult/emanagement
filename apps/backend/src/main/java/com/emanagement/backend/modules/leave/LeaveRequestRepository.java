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
}

