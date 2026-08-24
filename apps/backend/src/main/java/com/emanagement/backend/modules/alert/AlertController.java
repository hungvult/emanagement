package com.emanagement.backend.modules.alert;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.alert.dto.AnomalyAlertResponseDto;
import com.emanagement.backend.modules.alert.dto.ResolveAlertRequestDto;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
@Tag(name = "Cảnh Báo Bất Thường AI", description = "Các API theo dõi sự cố nhận diện, quên check-in/out và xử lý cảnh báo")
public class AlertController {
    private final AlertService alertService;

    @GetMapping
    @Operation(summary = "Danh sách cảnh báo bất thường", description = "Lấy danh sách các cảnh báo sự cố do hệ thống ghi nhận, có thể lọc theo trạng thái đã giải quyết hay chưa")
    public ResponseEntity<ApiResponse<PageResponse<AnomalyAlertResponseDto>>> getAlerts(
            @RequestParam(required = false) Boolean isResolved,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<AnomalyAlertResponseDto> response = alertService.getAlerts(isResolved, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}/resolve")
    @Operation(summary = "Xử lý cảnh báo sự cố", description = "Đánh dấu một cảnh báo bất thường đã được người quản lý kiểm tra và giải quyết")
    public ResponseEntity<ApiResponse<AnomalyAlertResponseDto>> resolveAlert(
            @PathVariable Long id,
            @Valid @RequestBody ResolveAlertRequestDto dto) {
        AnomalyAlertResponseDto response = alertService.resolveAlert(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Đã xử lý cảnh báo thành công", response));
    }
}
