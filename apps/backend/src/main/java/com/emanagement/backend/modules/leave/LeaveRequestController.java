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

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/leave-requests")
@RequiredArgsConstructor
public class LeaveRequestController {
    private final LeaveRequestServiceImpl leaveRequestServiceImpl;

    @PostMapping
    public ResponseEntity<ApiResponse<LeaveRequestResponseDto>> createLeaveRequest(
            @Valid @RequestBody LeaveRequestCreateDto dto) {
        LeaveRequestResponseDto response = leaveRequestServiceImpl.createLeaveRequest(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Gui don xin nghi phep thanh cong", response));
    }

    @GetMapping("/my-requests")
    public ResponseEntity<ApiResponse<List<LeaveRequestResponseDto>>> getMyLeaveRequests(@RequestParam Long userId) {
        List<LeaveRequestResponseDto> response = leaveRequestServiceImpl.getMyLeaveRequests(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<LeaveRequestResponseDto>>> getAllLeaveRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status) {
        PageResponse<LeaveRequestResponseDto> response = leaveRequestServiceImpl.getAllLeaveRequests(page, size,
                status);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<LeaveRequestResponseDto>> approveLeaveRequest(
            @PathVariable Long id,
            @Valid @RequestBody LeaveAprrovalDto dto) {
        LeaveRequestResponseDto response = leaveRequestServiceImpl.approveLeaveRequest(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Duyet don xin nghi phep thanh cong", response));
    }
}
