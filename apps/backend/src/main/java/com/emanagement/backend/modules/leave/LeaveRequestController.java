package com.emanagement.backend.modules.leave;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.emanagement.backend.security.UserPrincipal;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.leave.dto.LeaveAprrovalDto;
import com.emanagement.backend.modules.leave.dto.LeaveRequestCreateDto;
import com.emanagement.backend.modules.leave.dto.LeaveRequestResponseDto;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/leave-requests")
@RequiredArgsConstructor
@Tag(name = "Đơn Xin Nghỉ Phép", description = "Các API tạo đơn nghỉ phép cá nhân và phê duyệt đơn dành cho Admin")
public class LeaveRequestController {
    private final LeaveRequestService leaveRequestService;

    @PostMapping
    @Operation(summary = "Tạo đơn xin nghỉ phép", description = "Nhân viên gửi đơn xin nghỉ phép với lý do và thời gian cụ thể")
    public ResponseEntity<ApiResponse<LeaveRequestResponseDto>> createLeaveRequest(
            @Valid @RequestBody LeaveRequestCreateDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (principal != null) {
            boolean isAdmin = principal.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
            if (!isAdmin || dto.getUserId() == null) {
                dto.setUserId(principal.getId());
            }
        }
        LeaveRequestResponseDto response = leaveRequestService.createLeaveRequest(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Gửi đơn xin nghỉ phép thành công", response));
    }

    @GetMapping("/my-requests")
    @Operation(summary = "Đơn nghỉ phép của tôi", description = "Lấy danh sách các đơn xin nghỉ phép do nhân viên hiện tại tạo")
    public ResponseEntity<ApiResponse<List<LeaveRequestResponseDto>>> getMyLeaveRequests(
            @RequestParam(required = false) Long userId,
            @AuthenticationPrincipal UserPrincipal principal) {
        Long targetUserId = (principal != null) ? principal.getId() : userId;
        if (principal != null && userId != null) {
            boolean isAdmin = principal.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
            if (isAdmin) {
                targetUserId = userId;
            }
        }
        List<LeaveRequestResponseDto> response = leaveRequestService.getMyLeaveRequests(targetUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(summary = "Danh sách đơn nghỉ phép toàn hệ thống", description = "Dành cho Admin xem, tìm kiếm và lọc danh sách đơn nghỉ phép")
    public ResponseEntity<ApiResponse<PageResponse<LeaveRequestResponseDto>>> getAllLeaveRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String keyword) {
        PageResponse<LeaveRequestResponseDto> response = leaveRequestService.getAllLeaveRequests(
                page, size, status, startDate, endDate, keyword);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(summary = "Phê duyệt / Từ chối đơn nghỉ phép", description = "Quản lý cập nhật trạng thái đơn nghỉ phép (APPROVED hoặc REJECTED)")
    public ResponseEntity<ApiResponse<LeaveRequestResponseDto>> approveLeaveRequest(
            @PathVariable Long id,
            @Valid @RequestBody LeaveAprrovalDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (principal != null) {
            dto.setApprovedByUserId(principal.getId());
        }
        LeaveRequestResponseDto response = leaveRequestService.approveLeaveRequest(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Duyệt đơn xin nghỉ phép thành công", response));
    }
}
