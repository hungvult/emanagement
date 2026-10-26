package com.emanagement.backend.modules.shift.dto;

import java.util.List;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.employee.dto.EmployeeResponseDto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Dữ liệu lịch phân ca tuần có phân trang nhân viên")
public class WeeklyScheduleResponseDto {

    @Schema(description = "Trang danh sách nhân viên")
    private PageResponse<EmployeeResponseDto> employees;

    @Schema(description = "Danh sách ca làm việc của các nhân viên trong trang hiện tại")
    private List<EmployeeShiftResponseDto> assignments;
}
