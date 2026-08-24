package com.emanagement.backend.modules.kiosk.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu đăng ký trạm Kiosk mới (Mã trạm KSK-NămTháng-STT và Token được hệ thống tự sinh 100%)")
public class KioskRegisterDto {

    @NotBlank(message = "Tên trạm Kiosk không được để trống")
    @Size(min = 2, max = 150, message = "Tên trạm Kiosk từ 2 đến 150 ký tự")
    @Schema(description = "Tên mô tả trạm Kiosk", example = "Trạm Kiosk Cổng Chính")
    private String name;
}
