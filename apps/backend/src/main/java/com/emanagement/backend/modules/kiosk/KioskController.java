package com.emanagement.backend.modules.kiosk;

import org.springframework.http.HttpStatus;
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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/kiosks")
@RequiredArgsConstructor
@Tag(name = "Trạm Kiosk Chấm Công", description = "Các API nhận diện khuôn mặt và chấm công tại trạm Kiosk")
public class KioskController {
    private final KioskService kioskService;

    @PostMapping("/check-in")
    @Operation(summary = "Kiosk AI Check-in / Check-out", description = "Xác thực token trạm và tiếp nhận frame ảnh Base64 từ camera Kiosk để đọ sánh AI chấm công")
    public ResponseEntity<ApiResponse<KioskCheckInResponseDto>> checkIn(
            @RequestHeader("X-Kiosk-Token") String deviceToken,
            @Valid @RequestBody KioskCheckInRequestDto request) {
        KioskCheckInResponseDto response = kioskService.processCheckIn(deviceToken, request);
        return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
    }

    @PostMapping("/register")
    @Operation(summary = "Đăng ký trạm Kiosk mới", description = "Tạo mới thông tin trạm Kiosk và sinh Device Token")
    public ResponseEntity<ApiResponse<Kiosk>> registerKiosk(@Valid @RequestBody KioskRegisterDto dto) {
        Kiosk kiosk = kioskService.registerKiosk(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đăng ký trạm Kiosk thành công", kiosk));
    }

    @org.springframework.web.bind.annotation.GetMapping
    @Operation(summary = "Danh sách trạm Kiosk", description = "Lấy danh sách tất cả các trạm Kiosk trong hệ thống")
    public ResponseEntity<ApiResponse<java.util.List<com.emanagement.backend.modules.kiosk.dto.KioskResponseDto>>> getAllKiosks() {
        java.util.List<com.emanagement.backend.modules.kiosk.dto.KioskResponseDto> kiosks = kioskService.getAllKiosks();
        return ResponseEntity.ok(ApiResponse.success(kiosks));
    }

    @org.springframework.web.bind.annotation.PutMapping("/{id}")
    @Operation(summary = "Cập nhật thông tin trạm Kiosk", description = "Chỉnh sửa tên và trạng thái hoạt động của trạm Kiosk")
    public ResponseEntity<ApiResponse<com.emanagement.backend.modules.kiosk.dto.KioskResponseDto>> updateKiosk(
            @org.springframework.web.bind.annotation.PathVariable Long id,
            @Valid @RequestBody com.emanagement.backend.modules.kiosk.dto.KioskUpdateDto dto) {
        com.emanagement.backend.modules.kiosk.dto.KioskResponseDto response = kioskService.updateKiosk(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật trạm Kiosk thành công", response));
    }

    @PostMapping("/{id}/regenerate-token")
    @Operation(summary = "Cấp lại Device Token cho trạm Kiosk", description = "Tạo mới Hardware JWT Device Token khi trạm Kiosk cài lại máy hoặc mất cấu hình")
    public ResponseEntity<ApiResponse<com.emanagement.backend.modules.kiosk.dto.KioskResponseDto>> regenerateToken(
            @org.springframework.web.bind.annotation.PathVariable Long id) {
        com.emanagement.backend.modules.kiosk.dto.KioskResponseDto response = kioskService.regenerateKioskToken(id);
        return ResponseEntity.ok(ApiResponse.success("Cấp lại Token trạm Kiosk thành công", response));
    }

    @PostMapping("/heartbeat")
    @Operation(summary = "Heartbeat trạm Kiosk", description = "Trạm Kiosk gửi tín hiệu định kỳ kèm token để xác nhận trạng thái kết nối máy chủ")
    public ResponseEntity<ApiResponse<com.emanagement.backend.modules.kiosk.dto.KioskHeartbeatResponseDto>> heartbeat(
            @RequestHeader("X-Kiosk-Token") String deviceToken) {
        com.emanagement.backend.modules.kiosk.dto.KioskHeartbeatResponseDto response = kioskService.processHeartbeat(deviceToken);
        return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
    }
}
