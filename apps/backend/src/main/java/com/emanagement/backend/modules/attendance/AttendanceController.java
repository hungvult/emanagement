package com.emanagement.backend.modules.attendance;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.attendance.dto.AttendanceHistoryDto;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/attendances")
@RequiredArgsConstructor
@Tag(name = "Nhật Ký Chấm Công", description = "Các API tra cứu lịch sử chấm công cá nhân và toàn doanh nghiệp")
public class AttendanceController {
    private final AttendanceService attendanceService;

    @GetMapping("/my-history")
    @Operation(summary = "Lịch sử chấm công cá nhân", description = "Tra cứu danh sách các lượt chấm công của nhân viên (tự động lấy từ Token hoặc truyền userId)")
    public ResponseEntity<ApiResponse<PageResponse<AttendanceHistoryDto>>> getMyHistory(
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.emanagement.backend.security.UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Long targetUserId = (userId != null) ? userId : (principal != null ? principal.getId() : null);
        if (targetUserId == null) {
            throw new com.emanagement.backend.common.exception.BusinessException("Vui lòng đăng nhập hoặc cung cấp userId");
        }
        PageResponse<AttendanceHistoryDto> response = attendanceService.getUserHistory(targetUserId, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/records")
    @Operation(summary = "Danh sách chấm công toàn hệ thống", description = "Dành cho Admin/Quản lý theo dõi toàn bộ dữ liệu vào ra của doanh nghiệp")
    public ResponseEntity<ApiResponse<PageResponse<AttendanceHistoryDto>>> getAllRecords(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<AttendanceHistoryDto> response = attendanceService.getAllRecords(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
