package com.emanagement.backend.modules.shift;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/shifts")
@RequiredArgsConstructor
@Tag(name = "Ca Làm Việc & Phân Ca", description = "Các API quản lý danh mục ca làm việc và phân ca cho nhân viên")
public class ShiftController {
    private final ShiftService shiftService;

    @PostMapping
    @Operation(summary = "Tạo ca làm việc mới", description = "Tạo mới một ca làm việc với khung giờ bắt đầu, kết thúc và số phút gia hạn")
    public ResponseEntity<ApiResponse<ShiftResponseDto>> createShift(@Valid @RequestBody ShiftCreateDto dto) {
        ShiftResponseDto response = shiftService.createShift(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo mới ca làm việc thành công", response));
    }

    @GetMapping
    @Operation(summary = "Danh sách ca làm việc", description = "Lấy danh sách tất cả các ca làm việc trong hệ thống")
    public ResponseEntity<ApiResponse<List<ShiftResponseDto>>> getAllShifts() {
        List<ShiftResponseDto> response = shiftService.getAllShifts();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/assign")
    @Operation(summary = "Phân ca cho nhân viên", description = "Gán một ca làm việc cụ thể cho nhân viên vào ngày làm việc")
    public ResponseEntity<ApiResponse<Void>> assignShift(@Valid @RequestBody AssignShiftDto dto) {
        shiftService.assignShift(dto);
        return ResponseEntity.ok(ApiResponse.success("Phân ca thành công cho nhân viên", null));
    }
}
