package com.emanagement.backend.modules.attendance;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.attendance.dto.AttendanceHistoryDto;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/attendance")
@RequiredArgsConstructor
public class AttendanceController {
    private final AttendanceServiceImpl attendanceServiceImpl;

    @GetMapping("/my-history")
    public ResponseEntity<ApiResponse<PageResponse<AttendanceHistoryDto>>> getMyHistory(
            @RequestParam Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<AttendanceHistoryDto> response = attendanceServiceImpl.getUserHistory(userId, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/records")
    public ResponseEntity<ApiResponse<PageResponse<AttendanceHistoryDto>>> getAllRecords(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<AttendanceHistoryDto> response = attendanceServiceImpl.getAllRecords(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
