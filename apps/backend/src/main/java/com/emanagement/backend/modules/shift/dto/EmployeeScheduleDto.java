package com.emanagement.backend.modules.shift.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Thông tin chi tiết ca làm việc được phân cho nhân viên")
public class EmployeeScheduleDto {
    @Schema(description = "ID bản ghi phân ca", example = "10")
    private Long id;

    @Schema(description = "ID ca làm việc", example = "1")
    private Long shiftId;

    @Schema(description = "Mã ca làm việc", example = "SHIFT-001")
    private String shiftCode;

    @Schema(description = "Tên ca làm việc", example = "Ca Hành Chính")
    private String shiftName;

    @Schema(description = "Giờ bắt đầu làm việc", example = "08:00:00")
    private LocalTime startTime;

    @Schema(description = "Giờ kết thúc ca", example = "17:30:00")
    private LocalTime endTime;

    @Schema(description = "Số phút được phép đi trễ", example = "15")
    private Integer gracePeriodMinutes;

    @Schema(description = "Ngày làm việc được phân ca", example = "2026-09-16")
    private LocalDate assignedDate;
}
