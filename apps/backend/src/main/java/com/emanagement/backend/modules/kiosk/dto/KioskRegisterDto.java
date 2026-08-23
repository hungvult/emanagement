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
public class KioskRegisterDto {
    @NotBlank(message = "Ma tram khong duoc de trong")
    private String kioskCode;
    @NotBlank(message = "Ten tram khong duoc de trong")
    private String name;
}
