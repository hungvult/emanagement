package com.emanagement.backend.modules.attendance.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Lịch sử chi tiết một lượt chấm công nhận diện khuôn mặt")
public class AttendanceHistoryDto {

    @Schema(description = "ID lượt chấm công", example = "101")
    private Long id;

    @Schema(description = "ID nhân viên", example = "1")
    private Long userId;

    @Schema(description = "Mã nhân viên", example = "EMP260001")
    private String employeeCode;

    @Schema(description = "Họ và tên nhân viên", example = "Nguyễn Văn C")
    private String fullName;

    @Schema(description = "Tên trạm Kiosk thực hiện chấm công", example = "Trạm Kiosk Cổng Chính")
    private String kioskName;

    @Schema(description = "Thời gian Check-in vào ca", example = "2026-08-24T07:55:12")
    private LocalDateTime checkInTime;

    @Schema(description = "Thời gian Check-out tan ca", example = "2026-08-24T17:35:40")
    private LocalDateTime checkOutTime;

    @Schema(description = "Trạng thái chấm công: ON_TIME (Đúng giờ), LATE (Đi muộn), EARLY_LEAVE (Về sớm)", example = "ON_TIME")
    private String status;

    @Schema(description = "Ảnh chụp bằng chứng nhận diện từ camera trạm", example = "minio://attendance/checkin_EMP260001_1724482800.jpg")
    private String snapshotUrl;
}
