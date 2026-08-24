package com.emanagement.backend.modules.kiosk.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class KioskCheckInRequestDto {

    @NotBlank(message = "Khung hình ảnh không được để trống")
    private String imageFrameBase64;
}
