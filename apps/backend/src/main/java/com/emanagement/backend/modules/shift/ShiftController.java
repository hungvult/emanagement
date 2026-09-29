package com.emanagement.backend.modules.shift;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.EmployeeShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.emanagement.backend.security.UserPrincipal;

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

    @GetMapping("/schedule")
    @Operation(summary = "Lịch phân ca theo tuần", description = "Lấy toàn bộ lịch phân ca của tất cả nhân viên trong khoảng thời gian")
    public ResponseEntity<ApiResponse<List<EmployeeShiftResponseDto>>> getSchedule(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<EmployeeShiftResponseDto> data = shiftService.getSchedule(startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success("Lấy lịch phân ca thành công", data));
    }

    @GetMapping("/my-schedule")
    @Operation(summary = "Lịch làm việc của tôi", description = "Nhân viên đang đăng nhập xem các ca được phân trong khoảng ngày")
    public ResponseEntity<ApiResponse<List<EmployeeShiftResponseDto>>> getMySchedule(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<EmployeeShiftResponseDto> data = shiftService.getMySchedule(principal.getId(), startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success("Lấy lịch làm việc thành công", data));
    }

    @DeleteMapping("/assign")
    @Operation(summary = "Hủy ca làm việc của nhân viên", description = "Xóa ca làm việc đã phân cho nhân viên vào ngày cụ thể và gửi thông báo")
    public ResponseEntity<ApiResponse<Void>> removeAssignedShift(
            @RequestParam Long userId,
            @RequestParam String assignedDate) {
        shiftService.removeAssignedShift(userId, assignedDate);
        return ResponseEntity.ok(ApiResponse.success("Đã hủy ca làm việc thành công", null));
    }
}
