package com.emanagement.backend.modules.shift;

import java.time.LocalDate;
import java.util.List;

import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.BulkAssignDto;
import com.emanagement.backend.modules.shift.dto.BulkAssignResultDto;
import com.emanagement.backend.modules.shift.dto.CopyWeekDto;
import com.emanagement.backend.modules.shift.dto.EmployeeShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftUpdateDto;

public interface ShiftService {
    ShiftResponseDto createShift(ShiftCreateDto dto);

    List<ShiftResponseDto> getAllShifts(boolean includeInactive);

    /** Sửa định nghĩa ca. Đổi giờ chỉ áp dụng cho lịch từ ngày mai (hoặc effectiveFrom) trở đi. */
    ShiftResponseDto updateShift(Long id, ShiftUpdateDto dto);

    /** Xóa mềm (hoặc xóa cứng nếu chưa từng dùng). Trả về "DELETED" hoặc "DEACTIVATED". */
    String removeShift(Long id, Long replaceWithShiftId);

    void assignShift(AssignShiftDto dto);

    BulkAssignResultDto bulkAssign(BulkAssignDto dto);

    BulkAssignResultDto copyWeek(CopyWeekDto dto);

    List<EmployeeShiftResponseDto> getSchedule(LocalDate startDate, LocalDate endDate);

    List<EmployeeShiftResponseDto> getMySchedule(Long userId, LocalDate startDate, LocalDate endDate);

    void removeAssignedShift(Long userId, LocalDate assignedDate);

    /** Gọi khi đơn nghỉ phép được duyệt: hủy các ca đã phân trong khoảng nghỉ. */
    void cancelShiftsForLeave(User user, LocalDate from, LocalDate to);
}
