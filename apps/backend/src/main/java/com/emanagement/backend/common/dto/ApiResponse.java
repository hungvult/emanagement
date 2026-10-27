package com.emanagement.backend.common.dto;

import java.time.OffsetDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Đối tượng phản hồi tiêu chuẩn của hệ thống")
public class ApiResponse<T> {

    @Schema(description = "Trạng thái phản hồi: SUCCESS, ERROR, VALIDATION_ERROR", example = "SUCCESS")
    private String status;

    @Schema(description = "Thông điệp phản hồi", example = "Thao tác thành công")
    private String message;

    @Schema(description = "Dữ liệu trả về", nullable = true)
    private T data;

    @Schema(description = "Thời điểm phản hồi", example = "2026-08-24T12:00:00Z")
    @JsonFormat(shape = JsonFormat.Shape.STRING)
    @Builder.Default
    private OffsetDateTime timestamp = OffsetDateTime.now();

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .status("SUCCESS")
                .message("Thao tác thành công")
                .data(data)
                .timestamp(OffsetDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return ApiResponse.<T>builder()
                .status("SUCCESS")
                .message(message)
                .data(data)
                .timestamp(OffsetDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder()
                .status("ERROR")
                .message(message)
                .data(null)
                .timestamp(OffsetDateTime.now())
                .build();
    }
}
