package com.emanagement.backend.modules.kiosk;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.modules.kiosk.dto.KioskCheckInRequestDto;
import com.emanagement.backend.modules.kiosk.dto.KioskCheckInResponseDto;
import com.emanagement.backend.modules.kiosk.dto.KioskRegisterDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("api/v1/kiosk")
@RequiredArgsConstructor
public class KioskController {
    private final KioskServiceImpl kioskServiceImpl;

    @PostMapping("/check-in")
    public ResponseEntity<ApiResponse<KioskCheckInResponseDto>> checkIn(
            @RequestHeader("X-Kiosk-Token") String deviceToken,
            @Valid @RequestBody KioskCheckInRequestDto request) {
        KioskCheckInResponseDto response = kioskServiceImpl.processCheckIn(deviceToken, request);
        return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<Kiosk>> registerKiosk(@Valid @RequestBody KioskRegisterDto dto) {
        Kiosk kiosk = kioskServiceImpl.registerKiosk(dto);
        return ResponseEntity.ok(ApiResponse.success("Dang ky tram Kiosk thanh cong", kiosk));
    }
}
