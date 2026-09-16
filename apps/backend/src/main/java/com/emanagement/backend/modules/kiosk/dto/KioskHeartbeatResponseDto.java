package com.emanagement.backend.modules.kiosk.dto;

import java.time.LocalDateTime;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Phản hồi xác nhận tín hiệu Heartbeat từ trạm Kiosk")
public class KioskHeartbeatResponseDto {
    @Schema(description = "Mã trạm Kiosk", example = "KSK-2608-001")
    private String kioskCode;

    @Schema(description = "Tên trạm Kiosk", example = "Trạm Kiosk Cổng Chính")
    private String name;

    @Schema(description = "Trạng thái trạm", example = "ACTIVE")
    private String status;

    @Schema(description = "Thời gian máy chủ tiếp nhận heartbeat", example = "2026-09-16T12:00:00")
    private LocalDateTime serverTime;

    @Schema(description = "Thông điệp xác nhận", example = "Heartbeat received successfully")
    private String message;
}
