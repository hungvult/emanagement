package com.emanagement.backend.modules.shift.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AssignShiftDto {

    @NotNull(message = "ID nhân viên không được để trống")
    private Long userId;

    @NotNull(message = "ID ca làm việc không được để trống")
    private Long shiftId;

    @NotNull(message = "Ngày phân ca không được để trống")
    private LocalDate assignedDate;
}
