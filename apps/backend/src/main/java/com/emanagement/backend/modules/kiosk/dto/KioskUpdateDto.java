package com.emanagement.backend.modules.kiosk.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu cập nhật thông tin trạm Kiosk")
public class KioskUpdateDto {
    @Size(min = 2, max = 150, message = "Tên trạm phải từ 2 đến 150 ký tự")
    @Schema(description = "Tên mô tả trạm Kiosk", example = "Trạm Kiosk Tầng 2")
    private String name;

    @Pattern(regexp = "^(ACTIVE|INACTIVE)$", message = "Trạng thái chỉ có thể là ACTIVE hoặc INACTIVE")
    @Schema(description = "Trạng thái trạm Kiosk", example = "ACTIVE")
    private String status;
}
