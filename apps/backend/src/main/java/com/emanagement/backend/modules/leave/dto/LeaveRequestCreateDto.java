package com.emanagement.backend.modules.leave.dto;

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
public class LeaveRequestCreateDto {
    @NotNull(message = "ID nhan vien khong duoc de trong")
    private Long userId;

    @NotNull(message = "Ngay bat dau khong duoc de trong")
    private LocalDate startDate;

    @NotNull(message = "Ngay ket thuc khong duoc de trong")
    private LocalDate endDate;

    @NotBlank(message = "Ly do xin nghi khong duoc de trong")
    private String reason;
}
