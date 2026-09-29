package com.emanagement.backend.modules.attendance;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.attendance.dto.AttendanceHistoryDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AttendanceServiceImpl implements AttendanceService {
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final StorageService storageService;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttendanceHistoryDto> getUserHistory(Long userId, int page, int size,
            LocalDate startDate, LocalDate endDate, String status) {
        PageRequest pageRequest = PageRequest.of(page, size);
        LocalDateTime start = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime end = endDate != null ? endDate.plusDays(1).atStartOfDay() : null;
        String statusFilter = (status != null && !status.isBlank()) ? status : null;
        Page<AttendanceRecord> records = attendanceRecordRepository.findByUserIdWithFilters(
                userId, 
                start != null, start, 
                end != null, end, 
                statusFilter != null, statusFilter, 
                pageRequest);
        return PageResponse.from(records.map(this::mapToDto));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttendanceHistoryDto> getAllRecords(int page, int size,
            LocalDate startDate, LocalDate endDate, String status) {
        PageRequest pageRequest = PageRequest.of(page, size);
        LocalDateTime start = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime end = endDate != null ? endDate.plusDays(1).atStartOfDay() : null;
        String statusFilter = (status != null && !status.isBlank()) ? status : null;
        Page<AttendanceRecord> records = attendanceRecordRepository.findAllWithFilters(
                start != null, start, 
                end != null, end, 
                statusFilter != null, statusFilter, 
                pageRequest);
        return PageResponse.from(records.map(this::mapToDto));
    }

    private AttendanceHistoryDto mapToDto(AttendanceRecord record) {
        return AttendanceHistoryDto.builder()
                .id(record.getId())
                .userId(record.getUser().getId())
                .employeeCode(record.getUser().getEmployeeCode())
                .fullName(record.getUser().getFullName())
                .kioskName(record.getKiosk().getName())
                .checkInTime(record.getCheckInTime())
                .checkOutTime(record.getCheckOutTime())
                .status(record.getStatus())
                .snapshotUrl(storageService.getPresignedUrl(record.getSnapshotUrl(), 15))
                .checkoutSnapshotUrl(storageService.getPresignedUrl(record.getCheckoutSnapshotUrl(), 15))
                .build();
    }
}

