package com.emanagement.backend.modules.alert;

import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnomalyAlertRepository extends JpaRepository<AnomalyAlert, Long> {
    Page<AnomalyAlert> findByIsResolvedOrderByCreatedAtDesc(Boolean isResolved, Pageable pageable);

    @Query("""
        select a from AnomalyAlert a
        where (:hasIsResolved = false or a.isResolved = :isResolved)
          and (:hasStartDate = false or a.alertDate >= :startDate)
          and (:hasEndDate = false or a.alertDate <= :endDate)
          and (:hasShiftId = false or exists (
              select 1 from EmployeeShift es
              where es.user.id = a.user.id
                and es.assignedDate = a.alertDate
                and es.shift.id = :shiftId
          ) or (
              :isFallbackShift = true
              and not exists (
                  select 1 from EmployeeShift es2
                  where es2.user.id = a.user.id
                    and es2.assignedDate = a.alertDate
              )
          ))
        order by a.createdAt desc
    """)
    Page<AnomalyAlert> findWithFilters(
            @Param("hasIsResolved") boolean hasIsResolved,
            @Param("isResolved") Boolean isResolved,
            @Param("hasStartDate") boolean hasStartDate,
            @Param("startDate") LocalDate startDate,
            @Param("hasEndDate") boolean hasEndDate,
            @Param("endDate") LocalDate endDate,
            @Param("hasShiftId") boolean hasShiftId,
            @Param("shiftId") Long shiftId,
            @Param("isFallbackShift") boolean isFallbackShift,
            Pageable pageable);
}
