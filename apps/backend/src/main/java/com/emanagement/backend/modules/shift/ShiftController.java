package com.emanagement.backend.modules.shift;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.BulkAssignDto;
import com.emanagement.backend.modules.shift.dto.BulkAssignResultDto;
import com.emanagement.backend.modules.shift.dto.CopyWeekDto;
import com.emanagement.backend.modules.shift.dto.EmployeeShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftUpdateDto;
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
    public ResponseEntity<ApiResponse<List<ShiftResponseDto>>> getAllShifts(
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        List<ShiftResponseDto> response = shiftService.getAllShifts(includeInactive);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/assign")
    @Operation(summary = "Phân ca cho nhân viên", description = "Gán một ca làm việc cụ thể cho nhân viên vào ngày làm việc")
    public ResponseEntity<ApiResponse<Void>> assignShift(@Valid @RequestBody AssignShiftDto dto) {
        shiftService.assignShift(dto);
        return ResponseEntity.ok(ApiResponse.success("Phân ca thành công cho nhân viên", null));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Chỉnh sửa ca làm việc", description = "Sửa tên/giờ/grace. Đổi giờ chỉ áp dụng cho lịch từ ngày mai (hoặc effectiveFrom) trở đi")
    public ResponseEntity<ApiResponse<ShiftResponseDto>> updateShift(
            @PathVariable Long id, @Valid @RequestBody ShiftUpdateDto dto) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật ca làm việc thành công", shiftService.updateShift(id, dto)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa / ngừng sử dụng ca", description = "Chưa từng dùng: xóa hẳn. Đã dùng: ngừng sử dụng (giữ lịch sử). Nếu còn lịch tương lai phải truyền replaceWithShiftId")
    public ResponseEntity<ApiResponse<String>> removeShift(
            @PathVariable Long id,
            @RequestParam(required = false) Long replaceWithShiftId) {
        String action = shiftService.removeShift(id, replaceWithShiftId);
        String msg = "DELETED".equals(action) ? "Đã xóa ca làm việc" : "Ca làm việc đã được ngừng sử dụng";
        return ResponseEntity.ok(ApiResponse.success(msg, action));
    }

    @PostMapping("/bulk-assign")
    @Operation(summary = "Phân ca hàng loạt", description = "Nhiều nhân viên x khoảng ngày x các thứ trong tuần. dryRun=true để xem trước")
    public ResponseEntity<ApiResponse<BulkAssignResultDto>> bulkAssign(@Valid @RequestBody BulkAssignDto dto) {
        return ResponseEntity.ok(ApiResponse.success(
                Boolean.TRUE.equals(dto.getDryRun()) ? "Xem trước kết quả phân ca" : "Phân ca hàng loạt hoàn tất",
                shiftService.bulkAssign(dto)));
    }

    @PostMapping("/copy-week")
    @Operation(summary = "Sao chép lịch tuần", description = "Sao chép lịch 7 ngày từ tuần nguồn sang tuần đích. dryRun=true để xem trước")
    public ResponseEntity<ApiResponse<BulkAssignResultDto>> copyWeek(@Valid @RequestBody CopyWeekDto dto) {
        return ResponseEntity.ok(ApiResponse.success(
                Boolean.TRUE.equals(dto.getDryRun()) ? "Xem trước kết quả sao chép" : "Sao chép lịch hoàn tất",
                shiftService.copyWeek(dto)));
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
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long targetUserId = (userId != null) ? userId : (principal != null ? principal.getId() : null);
        if (targetUserId == null) {
            throw new BusinessException("Vui lòng đăng nhập hoặc cung cấp userId");
        }
        LocalDate start = (startDate != null) ? startDate : ((from != null) ? from : LocalDate.now().withDayOfMonth(1));
        LocalDate end = (endDate != null) ? endDate : ((to != null) ? to : start.plusMonths(1).minusDays(1));
        List<EmployeeShiftResponseDto> data = shiftService.getMySchedule(targetUserId, start, end);
        return ResponseEntity.ok(ApiResponse.success("Lấy lịch làm việc thành công", data));
    }

    @DeleteMapping("/assign")
    @Operation(summary = "Hủy ca làm việc của nhân viên", description = "Xóa ca làm việc đã phân cho nhân viên vào ngày cụ thể và gửi thông báo")
    public ResponseEntity<ApiResponse<Void>> removeAssignedShift(
            @RequestParam Long userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate assignedDate) {
        shiftService.removeAssignedShift(userId, assignedDate);
        return ResponseEntity.ok(ApiResponse.success("Đã hủy ca làm việc thành công", null));
    }
}
