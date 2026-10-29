package com.emanagement.backend.modules.employee;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    @Query("select distinct u from User u join u.roles r where u.status = 'ACTIVE' and r.name = 'ROLE_ADMIN'")
    List<User> findActiveAdmins();

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> lockForNotification(@Param("id") Long id);
    @Query("""
        select distinct u from User u join u.roles r
        where r.name in ('ROLE_USER', 'ROLE_EMPLOYEE')
          and not exists (select a.id from User a join a.roles ar where a.id = u.id and ar.name = 'ROLE_ADMIN')
        order by u.employeeCode
    """)
    List<User> findEmployeesForReport();

    Optional<User> findByEmail(String email);

    Optional<User> findByPhone(String phone);

    Optional<User> findByEmployeeCode(String employeeCode);

    @Query("SELECT u FROM User u WHERE u.employeeCode = :identifier OR u.email = :identifier OR u.phone = :identifier")
    Optional<User> findByIdentifier(@Param("identifier") String identifier);

    long countByStatus(String status);

    List<User> findByStatus(String status);

    @Query("SELECT DISTINCT u FROM User u JOIN u.roles r WHERE u.status = 'ACTIVE' AND r.name = 'ROLE_USER'")
    List<User> findActiveEmployees();

    @Query(value = """
        SELECT u FROM User u
        WHERE (u.status = 'ACTIVE' OR EXISTS (
            SELECT 1 FROM EmployeeShift es
            WHERE es.user = u AND es.assignedDate BETWEEN :startDate AND :endDate
        ))
        ORDER BY CASE WHEN EXISTS (
            SELECT 1 FROM EmployeeShift es
            WHERE es.user = u AND es.assignedDate BETWEEN :startDate AND :endDate
        ) THEN 0 ELSE 1 END ASC, u.fullName ASC, u.id ASC
    """, countQuery = """
        SELECT COUNT(u) FROM User u
        WHERE (u.status = 'ACTIVE' OR EXISTS (
            SELECT 1 FROM EmployeeShift es
            WHERE es.user = u AND es.assignedDate BETWEEN :startDate AND :endDate
        ))
    """)
    Page<User> findEmployeesForWeeklyScheduleWithoutKeyword(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    @Query(value = """
        SELECT u FROM User u
        WHERE (u.status = 'ACTIVE' OR EXISTS (
            SELECT 1 FROM EmployeeShift es
            WHERE es.user = u AND es.assignedDate BETWEEN :startDate AND :endDate
        ))
        AND (LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR
             LOWER(u.employeeCode) LIKE LOWER(CONCAT('%', :keyword, '%')) OR
             LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')) OR
             LOWER(u.phone) LIKE LOWER(CONCAT('%', :keyword, '%')))
        ORDER BY CASE WHEN EXISTS (
            SELECT 1 FROM EmployeeShift es
            WHERE es.user = u AND es.assignedDate BETWEEN :startDate AND :endDate
        ) THEN 0 ELSE 1 END ASC, u.fullName ASC, u.id ASC
    """, countQuery = """
        SELECT COUNT(u) FROM User u
        WHERE (u.status = 'ACTIVE' OR EXISTS (
            SELECT 1 FROM EmployeeShift es
            WHERE es.user = u AND es.assignedDate BETWEEN :startDate AND :endDate
        ))
        AND (LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR
             LOWER(u.employeeCode) LIKE LOWER(CONCAT('%', :keyword, '%')) OR
             LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')) OR
             LOWER(u.phone) LIKE LOWER(CONCAT('%', :keyword, '%')))
    """)
    Page<User> findEmployeesForWeeklyScheduleWithKeyword(
            @Param("keyword") String keyword,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    default Page<User> findEmployeesForWeeklySchedule(
            String keyword,
            LocalDate startDate,
            LocalDate endDate,
            Pageable pageable) {
        if (keyword == null || keyword.isBlank()) {
            return findEmployeesForWeeklyScheduleWithoutKeyword(startDate, endDate, pageable);
        }
        return findEmployeesForWeeklyScheduleWithKeyword(keyword.trim(), startDate, endDate, pageable);
    }
}
