package com.emanagement.backend.modules.shift;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeShiftRepository extends JpaRepository<EmployeeShift, Long> {
    Optional<EmployeeShift> findByUserIdAndAssignedDate(Long userId, LocalDate assignedDate);

    List<EmployeeShift> findByUserIdAndAssignedDateBetween(Long userId, LocalDate startDate, LocalDate endDate);
}
