package com.emanagement.backend.modules.attendance;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.attendance.dto.AttendanceHistoryDto;
import com.emanagement.backend.modules.shift.EmployeeShift;
import com.emanagement.backend.modules.shift.EmployeeShiftRepository;
import com.emanagement.backend.modules.shift.Shift;
import com.emanagement.backend.modules.shift.ShiftRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AttendanceServiceImpl implements AttendanceService {
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final EmployeeShiftRepository employeeShiftRepository;
    private final ShiftRepository shiftRepository;
    private final StorageService storageService;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttendanceHistoryDto> getUserHistory(Long userId, int page, int size,
            LocalDate startDate, LocalDate endDate, String status, Long shiftId) {
        return getRecordsInternal(userId, page, size, startDate, endDate, status, shiftId);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttendanceHistoryDto> getAllRecords(int page, int size,
            LocalDate startDate, LocalDate endDate, String status, Long shiftId) {
        return getRecordsInternal(null, page, size, startDate, endDate, status, shiftId);
    }

    private PageResponse<AttendanceHistoryDto> getRecordsInternal(Long userId, int page, int size,
            LocalDate startDate, LocalDate endDate, String status, Long shiftId) {
        PageRequest pageRequest = PageRequest.of(page, size);
        LocalDateTime start = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime end = endDate != null ? endDate.plusDays(1).atStartOfDay() : null;
        String statusFilter = (status != null && !status.isBlank()) ? status : null;
        boolean hasShiftId = shiftId != null;

        // Nếu lọc riêng trạng thái "Không có dữ liệu" (NO_DATA)
        if ("NO_DATA".equalsIgnoreCase(statusFilter)) {
            List<AttendanceHistoryDto> unattended = getUnattendedShifts(userId, startDate, endDate, shiftId);
            unattended.sort(Comparator.comparing(AttendanceHistoryDto::getWorkDate, Comparator.nullsLast(Comparator.reverseOrder())));
            return paginateList(unattended, pageRequest);
        }

        // Nếu lọc các trạng thái check-in cụ thể (ON_TIME, LATE, EARLY_LEAVE)
        if (statusFilter != null) {
            Page<AttendanceRecord> records;
            if (userId != null) {
                records = attendanceRecordRepository.findByUserIdWithFilters(
                        userId,
                        start != null, start,
                        end != null, end,
                        true, statusFilter,
                        hasShiftId, shiftId,
                        pageRequest);
            } else {
                records = attendanceRecordRepository.findAllWithFilters(
                        start != null, start,
                        end != null, end,
                        true, statusFilter,
                        hasShiftId, shiftId,
                        pageRequest);
            }
            return PageResponse.from(records.map(this::mapToDto));
        }

        // Trạng thái = "Tất cả": Gom cả bản ghi đã chấm công VÀ các ca chưa chấm công (NO_DATA)
        List<AttendanceHistoryDto> unattended = getUnattendedShifts(userId, startDate, endDate, shiftId);
        if (unattended.isEmpty()) {
            Page<AttendanceRecord> records;
            if (userId != null) {
                records = attendanceRecordRepository.findByUserIdWithFilters(
                        userId,
                        start != null, start,
                        end != null, end,
                        false, null,
                        hasShiftId, shiftId,
                        pageRequest);
            } else {
                records = attendanceRecordRepository.findAllWithFilters(
                        start != null, start,
                        end != null, end,
                        false, null,
                        hasShiftId, shiftId,
                        pageRequest);
            }
            return PageResponse.from(records.map(this::mapToDto));
        }

        // Lấy toàn bộ bản ghi check-in trong khoảng thời gian để ghép danh sách
        List<AttendanceRecord> attendedRecords;
        if (userId != null) {
            attendedRecords = attendanceRecordRepository.findByUserIdOrderByCheckInTimeDesc(userId, PageRequest.of(0, 1000)).getContent();
            if (start != null) {
                attendedRecords = attendedRecords.stream().filter(r -> r.getCheckInTime() != null && !r.getCheckInTime().isBefore(start)).collect(Collectors.toList());
            }
            if (end != null) {
                attendedRecords = attendedRecords.stream().filter(r -> r.getCheckInTime() != null && r.getCheckInTime().isBefore(end)).collect(Collectors.toList());
            }
            if (hasShiftId) {
                attendedRecords = attendedRecords.stream().filter(r -> r.getShift() != null && r.getShift().getId().equals(shiftId)).collect(Collectors.toList());
            }
        } else {
            // Lấy các bản ghi gần nhất (tối đa 1000)
            attendedRecords = attendanceRecordRepository.findAllWithFilters(
                    start != null, start,
                    end != null, end,
                    false, null,
                    hasShiftId, shiftId,
                    PageRequest.of(0, 1000)).getContent();
        }

        List<AttendanceHistoryDto> allList = new ArrayList<>();
        allList.addAll(attendedRecords.stream().map(this::mapToDto).collect(Collectors.toList()));
        allList.addAll(unattended);

        // Sắp xếp giảm dần theo ngày làm việc / thời gian check-in
        allList.sort((a, b) -> {
            LocalDate dateA = a.getWorkDate() != null ? a.getWorkDate() : (a.getCheckInTime() != null ? a.getCheckInTime().toLocalDate() : LocalDate.MIN);
            LocalDate dateB = b.getWorkDate() != null ? b.getWorkDate() : (b.getCheckInTime() != null ? b.getCheckInTime().toLocalDate() : LocalDate.MIN);
            int cmp = dateB.compareTo(dateA);
            if (cmp != 0) return cmp;
            LocalDateTime dtA = a.getCheckInTime() != null ? a.getCheckInTime() : LocalDateTime.MIN;
            LocalDateTime dtB = b.getCheckInTime() != null ? b.getCheckInTime() : LocalDateTime.MIN;
            return dtB.compareTo(dtA);
        });

        return paginateList(allList, pageRequest);
    }

    private List<AttendanceHistoryDto> getUnattendedShifts(Long userId, LocalDate startDate, LocalDate endDate, Long shiftId) {
        LocalDate today = LocalDate.now();
        LocalDate effectiveEnd = endDate != null && endDate.isBefore(today) ? endDate : today;
        LocalDate effectiveStart = startDate != null ? startDate : effectiveEnd.minusDays(30);

        if (effectiveStart.isAfter(effectiveEnd)) {
            return Collections.emptyList();
        }

        List<EmployeeShift> scheduledShifts;
        if (userId != null) {
            scheduledShifts = employeeShiftRepository.findByUserIdAndAssignedDateBetweenOrderByAssignedDateAsc(
                    userId, effectiveStart, effectiveEnd);
        } else {
            scheduledShifts = employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(
                    effectiveStart, effectiveEnd);
        }

        if (scheduledShifts.isEmpty()) {
            return Collections.emptyList();
        }

        if (shiftId != null) {
            scheduledShifts = scheduledShifts.stream()
                    .filter(es -> es.getShift() != null && es.getShift().getId().equals(shiftId))
                    .collect(Collectors.toList());
        }

        if (scheduledShifts.isEmpty()) {
            return Collections.emptyList();
        }

        LocalDateTime startDt = effectiveStart.atStartOfDay();
        LocalDateTime endDt = effectiveEnd.plusDays(1).atStartOfDay();

        List<AttendanceRecord> records;
        if (userId != null) {
            records = attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(userId, startDt, endDt);
        } else {
            Set<Long> userIds = scheduledShifts.stream().map(es -> es.getUser().getId()).collect(Collectors.toSet());
            records = attendanceRecordRepository.findByUserIdInAndCheckInTimeBetween(userIds, startDt, endDt);
        }

        Set<String> attendedKeys = records.stream()
                .filter(r -> r.getUser() != null && r.getCheckInTime() != null)
                .map(r -> r.getUser().getId() + "_" + r.getCheckInTime().toLocalDate())
                .collect(Collectors.toSet());

        List<AttendanceHistoryDto> unattended = new ArrayList<>();
        for (EmployeeShift es : scheduledShifts) {
            String key = es.getUser().getId() + "_" + es.getAssignedDate();
            if (!attendedKeys.contains(key)) {
                unattended.add(AttendanceHistoryDto.builder()
                        .id(-es.getId())
                        .userId(es.getUser().getId())
                        .employeeCode(es.getUser().getEmployeeCode())
                        .fullName(es.getUser().getFullName())
                        .kioskName("—")
                        .shiftId(es.getShift() != null ? es.getShift().getId() : null)
                        .shiftName(es.getShiftName() != null ? es.getShiftName() : (es.getShift() != null ? es.getShift().getName() : "—"))
                        .workDate(es.getAssignedDate())
                        .checkInTime(null)
                        .checkOutTime(null)
                        .status("NO_DATA")
                        .snapshotUrl(null)
                        .checkoutSnapshotUrl(null)
                        .build());
            }
        }
        return unattended;
    }

    private PageResponse<AttendanceHistoryDto> paginateList(List<AttendanceHistoryDto> list, PageRequest pageRequest) {
        int total = list.size();
        int start = (int) pageRequest.getOffset();
        int end = Math.min((start + pageRequest.getPageSize()), total);
        List<AttendanceHistoryDto> subList = start < total ? list.subList(start, end) : Collections.emptyList();
        Page<AttendanceHistoryDto> page = new PageImpl<>(subList, pageRequest, total);
        return PageResponse.from(page);
    }

    private AttendanceHistoryDto mapToDto(AttendanceRecord record) {
        LocalDate workDate = record.getCheckInTime() != null ? record.getCheckInTime().toLocalDate()
                : (record.getCreatedAt() != null ? record.getCreatedAt().toLocalDate() : null);

        Long shiftId = null;
        String shiftName = null;

        if (record.getShift() != null) {
            shiftId = record.getShift().getId();
            shiftName = record.getShift().getName();
        } else if (workDate != null && record.getUser() != null) {
            // Tra cứu từ employee_shifts đã phân công
            EmployeeShift es = employeeShiftRepository.findByUserIdAndAssignedDate(record.getUser().getId(), workDate).orElse(null);
            if (es != null) {
                shiftId = es.getShift() != null ? es.getShift().getId() : null;
                shiftName = es.getShiftName();
            } else {
                Shift fallback = shiftRepository.findByShiftCode("SHIFT-001").orElse(null);
                if (fallback != null) {
                    shiftId = fallback.getId();
                    shiftName = fallback.getName();
                }
            }
        }

        return AttendanceHistoryDto.builder()
                .id(record.getId())
                .userId(record.getUser().getId())
                .employeeCode(record.getUser().getEmployeeCode())
                .fullName(record.getUser().getFullName())
                .kioskName(record.getKiosk() != null ? record.getKiosk().getName() : "—")
                .shiftId(shiftId)
                .shiftName(shiftName)
                .workDate(workDate)
                .checkInTime(record.getCheckInTime())
                .checkOutTime(record.getCheckOutTime())
                .status(record.getStatus())
                .snapshotUrl(storageService.getPresignedUrl(record.getSnapshotUrl(), 15))
                .checkoutSnapshotUrl(storageService.getPresignedUrl(record.getCheckoutSnapshotUrl(), 15))
                .build();
    }
}
