package com.emanagement.backend.modules.shift;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeShiftRepository extends JpaRepository<EmployeeShift, Long> {
    Optional<EmployeeShift> findByUserIdAndAssignedDate(Long userId, LocalDate assignedDate);

    List<EmployeeShift> findByUserIdAndAssignedDateBetween(Long userId, LocalDate startDate, LocalDate endDate);

    // Lịch của mọi nhân viên: fetch sẵn user + shift để tránh N+1
    @EntityGraph(attributePaths = { "user", "shift" })
    List<EmployeeShift> findByAssignedDateBetweenOrderByAssignedDateAsc(LocalDate startDate, LocalDate endDate);

    @EntityGraph(attributePaths = { "user", "shift" })
    List<EmployeeShift> findByUserIdAndAssignedDateBetweenOrderByAssignedDateAsc(
            Long userId, LocalDate startDate, LocalDate endDate);

    // Lịch của một nhóm nhân viên (dùng cho phân ca hàng loạt / sao chép tuần)
    @EntityGraph(attributePaths = { "user", "shift" })
    List<EmployeeShift> findByUserIdInAndAssignedDateBetween(
            Collection<Long> userIds, LocalDate startDate, LocalDate endDate);

    // Các lượt phân công của một ca từ một ngày trở đi (dùng khi sửa giờ / ngừng ca)
    @EntityGraph(attributePaths = { "user", "shift" })
    List<EmployeeShift> findByShiftIdAndAssignedDateGreaterThanEqual(Long shiftId, LocalDate fromDate);

    boolean existsByShiftId(Long shiftId);
}
