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
@Schema(description = "Thông tin trạm Kiosk chấm công")
public class KioskResponseDto {
    @Schema(description = "ID trạm Kiosk", example = "1")
    private Long id;

    @Schema(description = "Mã định danh trạm Kiosk", example = "KSK-2608-001")
    private String kioskCode;

    @Schema(description = "Tên mô tả trạm Kiosk", example = "Trạm Kiosk Cổng Chính")
    private String name;

    @Schema(description = "Hardware JWT Device Token", example = "eyJhbGciOi...")
    private String deviceToken;

    @Schema(description = "Trạng thái trạm: ACTIVE hoặc INACTIVE", example = "ACTIVE")
    private String status;

    @Schema(description = "Thời điểm đăng ký trạm", example = "2026-08-24T12:00:00")
    private LocalDateTime createdAt;
}
