package com.emanagement.backend.modules.leave.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LeaveRequestCreateDto {

    @NotNull(message = "ID nhân viên không được để trống")
    private Long userId;

    @NotNull(message = "Ngày bắt đầu nghỉ không được để trống")
    private LocalDate startDate;

    @NotNull(message = "Ngày kết thúc nghỉ không được để trống")
    private LocalDate endDate;

    @NotBlank(message = "Lý do xin nghỉ không được để trống")
    @Size(min = 5, max = 500, message = "Lý do xin nghỉ từ 5 đến 500 ký tự")
    private String reason;
}
