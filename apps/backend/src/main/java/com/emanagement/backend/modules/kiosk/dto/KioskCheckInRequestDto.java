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
    @NotBlank(message = "Khung hinh anh khong duoc de trong")
    private String imageFrameBase64;
}
