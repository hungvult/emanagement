package com.emanagement.backend.modules.attendance;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.emanagement.backend.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.attendance.dto.AttendanceHistoryDto;
import com.emanagement.backend.modules.attendance.dto.ManualAttendanceRequestDto;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/attendances")
@RequiredArgsConstructor
@Tag(name = "Nhật Ký Chấm Công", description = "Các API tra cứu lịch sử chấm công cá nhân và toàn doanh nghiệp")
public class AttendanceController {
    private final AttendanceService attendanceService;

    @GetMapping("/my-history")
    @Operation(summary = "Lịch sử chấm công cá nhân", description = "Tra cứu danh sách các lượt chấm công của nhân viên theo userId")
    public ResponseEntity<ApiResponse<PageResponse<AttendanceHistoryDto>>> getMyHistory(
            @RequestParam(required = false) Long userId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long shiftId,
            @RequestParam(defaultValue = "false") boolean recordedOnly) {
        Long targetUserId = (principal != null) ? principal.getId() : userId;
        if (principal != null && userId != null) {
            boolean isAdmin = principal.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
            if (isAdmin) {
                targetUserId = userId;
            }
        }
        PageResponse<AttendanceHistoryDto> response = recordedOnly
                ? attendanceService.getUserRecordedHistory(targetUserId, page, size, startDate, endDate)
                : attendanceService.getUserHistory(targetUserId, page, size, startDate, endDate, status, shiftId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/records")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @Operation(summary = "Danh sách chấm công toàn hệ thống", description = "Dành cho Admin/Quản lý theo dõi toàn bộ dữ liệu vào ra của doanh nghiệp")
    public ResponseEntity<ApiResponse<PageResponse<AttendanceHistoryDto>>> getAllRecords(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long shiftId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String keyword) {
        String effectiveSearch = (search != null && !search.isBlank()) ? search.trim() : ((keyword != null && !keyword.isBlank()) ? keyword.trim() : null);
        PageResponse<AttendanceHistoryDto> response = attendanceService.getAllRecords(page, size, startDate, endDate, status, shiftId, effectiveSearch);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/manual")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @Operation(summary = "Thêm mới bản ghi chấm công thủ công", description = "Dành cho Admin bổ sung bản ghi chấm công cho nhân viên")
    public ResponseEntity<ApiResponse<AttendanceHistoryDto>> createManualRecord(
            @Valid @RequestBody ManualAttendanceRequestDto dto) {
        AttendanceHistoryDto response = attendanceService.createManualRecord(dto);
        return ResponseEntity.ok(ApiResponse.success("Thêm mới bản ghi chấm công thành công", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @Operation(summary = "Cập nhật bản ghi chấm công thủ công", description = "Dành cho Admin cập nhật ca làm việc, thời gian vào/ra hoặc giải trình chấm công")
    public ResponseEntity<ApiResponse<AttendanceHistoryDto>> updateManualRecord(
            @PathVariable Long id,
            @Valid @RequestBody ManualAttendanceRequestDto dto) {
        AttendanceHistoryDto response = attendanceService.updateManualRecord(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật bản ghi chấm công thành công", response));
    }


    @GetMapping("/export")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_MANAGER')")
    @Operation(summary = "Xuất báo cáo chấm công định dạng CSV Streaming", description = "Xuất dữ liệu chấm công CSV kèm UTF-8 BOM, hỗ trợ bộ lọc và tối ưu bộ nhớ cho doanh nghiệp lớn")
    public ResponseEntity<StreamingResponseBody> exportAttendance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long shiftId,
            @RequestParam(required = false) String search) {
        LocalDate effectiveStart = startDate != null ? startDate : LocalDate.now().withDayOfMonth(1);
        LocalDate effectiveEnd = endDate != null ? endDate : LocalDate.now();

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String filename = "bang_cham_cong_" + timestamp + ".csv";

        StreamingResponseBody stream = outputStream -> {
            attendanceService.exportAttendanceToCsv(outputStream, effectiveStart, effectiveEnd, status, shiftId, search);
        };

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(stream);
    }
}

