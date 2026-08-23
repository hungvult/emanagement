package com.emanagement.backend.modules.shift.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
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
    @NotNull(message = "ID nhan vien khong duoc de trong")
    private Long userId;

    @NotNull(message = "ID ca lam viec khong duoc de trong")
    private Long shiftId;

    @NotNull(message = "Ngay phan ca khong duoc de trong")
    private LocalDate assignedDate;
}
