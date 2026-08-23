package com.emanagement.backend.modules.alert;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.alert.dto.AnomalyAlertResponseDto;
import com.emanagement.backend.modules.alert.dto.ResolveAlertRequestDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
public class AlertController {
    private final AlertServiceImpl alertServiceImpl;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AnomalyAlertResponseDto>>> getAlerts(
            @RequestParam(required = false) Boolean isResolved,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<AnomalyAlertResponseDto> response = alertServiceImpl.getAlerts(isResolved, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}/resolve")
    public ResponseEntity<ApiResponse<AnomalyAlertResponseDto>> resolveAlert(
            @PathVariable Long id,
            @Valid @RequestBody ResolveAlertRequestDto dto) {
        AnomalyAlertResponseDto response = alertServiceImpl.resolveAlert(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Da xu ly canh bao thanh cong", response));
    }
}
