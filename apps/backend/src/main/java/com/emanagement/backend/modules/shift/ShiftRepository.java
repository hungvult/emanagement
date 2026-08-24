package com.emanagement.backend.modules.shift;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ShiftRepository extends JpaRepository<Shift, Long> {
    Optional<Shift> findByShiftCode(String shiftCode);
}
