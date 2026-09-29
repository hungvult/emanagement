package com.emanagement.backend.modules.employee.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Thông tin ảnh khuôn mặt eKYC đã đăng ký của nhân viên")
public class FaceImagesResponseDto {

    @Schema(description = "ID nhân viên", example = "1")
    private Long userId;

    @Schema(description = "Mã nhân viên", example = "EMP260001")
    private String employeeCode;

    @Schema(description = "Họ và tên nhân viên", example = "Nguyễn Văn A")
    private String fullName;

    @Schema(description = "Presigned URL ảnh chính diện")
    private String frontImageUrl;

    @Schema(description = "Presigned URL ảnh nháy mắt")
    private String blinkImageUrl;

    @Schema(description = "Presigned URL ảnh quay trái")
    private String leftImageUrl;

    @Schema(description = "Presigned URL ảnh quay phải")
    private String rightImageUrl;

    @Schema(description = "Presigned URL ảnh ngửa lên")
    private String upImageUrl;

    @Schema(description = "Thời điểm đăng ký khuôn mặt", example = "2026-08-24T12:00:00")
    private LocalDateTime registeredAt;
}
