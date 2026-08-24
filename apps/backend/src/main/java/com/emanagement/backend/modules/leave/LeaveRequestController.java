package com.emanagement.backend.modules.leave;

import java.util.List;

import org.springframework.http.HttpStatus;
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
            @Valid @RequestBody LeaveRequestCreateDto dto) {
        LeaveRequestResponseDto response = leaveRequestService.createLeaveRequest(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Gửi đơn xin nghỉ phép thành công", response));
    }

    @GetMapping("/my-requests")
    @Operation(summary = "Đơn nghỉ phép của tôi", description = "Lấy danh sách các đơn xin nghỉ phép do nhân viên hiện tại tạo")
    public ResponseEntity<ApiResponse<List<LeaveRequestResponseDto>>> getMyLeaveRequests(@RequestParam Long userId) {
        List<LeaveRequestResponseDto> response = leaveRequestService.getMyLeaveRequests(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @Operation(summary = "Danh sách đơn nghỉ phép toàn hệ thống", description = "Dành cho Admin xem và lọc danh sách đơn nghỉ phép theo trạng thái")
    public ResponseEntity<ApiResponse<PageResponse<LeaveRequestResponseDto>>> getAllLeaveRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        PageResponse<LeaveRequestResponseDto> response = leaveRequestService.getAllLeaveRequests(page, size, status);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}/approve")
    @Operation(summary = "Phê duyệt / Từ chối đơn nghỉ phép", description = "Quản lý cập nhật trạng thái đơn nghỉ phép (APPROVED hoặc REJECTED)")
    public ResponseEntity<ApiResponse<LeaveRequestResponseDto>> approveLeaveRequest(
            @PathVariable Long id,
            @Valid @RequestBody LeaveAprrovalDto dto) {
        LeaveRequestResponseDto response = leaveRequestService.approveLeaveRequest(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Duyệt đơn xin nghỉ phép thành công", response));
    }
}
