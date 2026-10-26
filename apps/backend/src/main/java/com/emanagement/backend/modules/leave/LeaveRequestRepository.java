package com.emanagement.backend.modules.leave;

import com.emanagement.backend.modules.shift.dto.ScheduleLeaveDto;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {
    @Query("""
        select new com.emanagement.backend.modules.shift.dto.ScheduleLeaveDto(l.user.id, l.startDate, l.endDate)
        from LeaveRequest l
        where l.status = 'APPROVED' and l.startDate <= :end and l.endDate >= :start
    """)
    List<ScheduleLeaveDto> findApprovedScheduleLeaves(
            @Param("start") LocalDate start, @Param("end") LocalDate end);

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

    // Lọc và tìm kiếm đơn nghỉ phép (dành cho Admin)
    @Query("""
        select l from LeaveRequest l
        where (:hasStatus = false or l.status = :status)
          and (:hasStartDate = false or l.endDate >= :startDate)
          and (:hasEndDate = false or l.startDate <= :endDate)
          and (:hasKeyword = false or (
                lower(l.user.fullName) like lower(concat('%', :keyword, '%'))
                or lower(l.user.employeeCode) like lower(concat('%', :keyword, '%'))
                or lower(l.reason) like lower(concat('%', :keyword, '%'))
          ))
        order by l.createdAt desc
    """)
    Page<LeaveRequest> findWithFilters(
            @Param("hasStatus") boolean hasStatus,
            @Param("status") String status,
            @Param("hasStartDate") boolean hasStartDate,
            @Param("startDate") LocalDate startDate,
            @Param("hasEndDate") boolean hasEndDate,
            @Param("endDate") LocalDate endDate,
            @Param("hasKeyword") boolean hasKeyword,
            @Param("keyword") String keyword,
            Pageable pageable);
}
