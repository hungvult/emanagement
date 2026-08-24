package com.emanagement.backend.modules.attendance;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.attendance.dto.AttendanceHistoryDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AttendanceServiceImpl implements AttendanceService {
    private final AttendanceRecordRepository attendanceRecordRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttendanceHistoryDto> getUserHistory(Long userId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<AttendanceRecord> records = attendanceRecordRepository.findByUserIdOrderByCheckInTimeDesc(userId,
                pageRequest);
        return PageResponse.from(records.map(this::mapToDto));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttendanceHistoryDto> getAllRecords(int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("checkInTime").descending());
        Page<AttendanceRecord> records = attendanceRecordRepository.findAll(pageRequest);
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
                .snapshotUrl(record.getSnapshotUrl())
                .build();
    }
}
