package com.emanagement.backend.modules.shift.dto;

import java.time.LocalTime;

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
public class ShiftCreateDto {
    @NotBlank(message = "Ma ca khong duoc de trong")
    private String shiftCode;

    @NotBlank(message = "Ten ca khong duoc de trong")
    private String name;

    @NotNull(message = "Gio bat dau khong duoc de trong")
    private LocalTime startTime;

    @NotNull(message = "Gio ket thuc khong duoc de trong")
    private LocalTime endTime;

    private Integer gracePeriodMinutes = 15;
}
