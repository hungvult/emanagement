package com.emanagement.backend.modules.attendance.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu thêm mới hoặc cập nhật chấm công thủ công của Admin")
public class ManualAttendanceRequestDto {

    @Schema(description = "ID nhân viên (bắt buộc khi tạo mới)", example = "1")
    private Long userId;

    @Schema(description = "ID ca làm việc (tùy chọn)", example = "1")
    private Long shiftId;

    @Schema(description = "Ngày làm việc (tùy chọn, dùng khi tạo mới)", example = "2026-10-24")
    private LocalDate workDate;

    @NotNull(message = "Thời gian vào ca không được để trống")
    @Schema(description = "Thời gian vào ca", example = "2026-10-24T08:00:00")
    private LocalDateTime checkInTime;

    @Schema(description = "Thời gian ra ca (tùy chọn)", example = "2026-10-24T17:00:00")
    private LocalDateTime checkOutTime;

    @Schema(description = "Trạng thái chấm công: ON_TIME, LATE, EARLY_LEAVE (nếu để trống sẽ tự động suy luận)", example = "ON_TIME")
    private String status;

    @Size(max = 500, message = "Ghi chú giải trình tối đa 500 ký tự")
    @Schema(description = "Ghi chú giải trình lý do sửa công thủ công", example = "Nhân viên quên check-in do vào ca gấp")
    private String note;
}
