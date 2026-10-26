package com.emanagement.backend.modules.dashboard.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.dashboard.dto.DashboardDailyTrendDto;
import com.emanagement.backend.modules.dashboard.dto.DashboardOverviewResponseDto;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.leave.LeaveRequestRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardServiceImpl implements DashboardService {

    private final UserRepository userRepository;
    private final LeaveRequestRepository leaveRequestRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;

    // Giờ bắt đầu tính là đi muộn (8:30)
    private static final LocalTime WORK_START = LocalTime.of(8, 30);

    @Override
    public DashboardOverviewResponseDto getOverview() {
        return getOverview(LocalDate.now());
    }

    @Override
    public DashboardOverviewResponseDto getOverview(LocalDate targetDate) {
        LocalDate today = LocalDate.now();
        LocalDate date = (targetDate != null) ? targetDate : today;
        LocalDateTime startOfDay = date.atStartOfDay();                  // 00:00:00
        LocalDateTime startOfNextDay = date.plusDays(1).atStartOfDay(); // 00:00:00 ngày mai
        LocalDateTime lateThreshold = date.atTime(WORK_START);           // 08:30:00 ngày đó

        // Tổng nhân viên đang hoạt động (status = "ACTIVE")
        long totalEmployees = userRepository.countByStatus("ACTIVE");

        // Số nhân viên đã check-in ngày đó (checkInTime trong [startOfDay, startOfNextDay))
        long presentToday = attendanceRecordRepository
                .countDistinctPresentUsers(startOfDay, startOfNextDay);

        // Số nhân viên đi muộn ngày đó (check-in đầu tiên sau 08:30)
        long lateToday = attendanceRecordRepository
                .countDistinctLateUsers(startOfDay, startOfNextDay, lateThreshold);

        // Số nhân viên nghỉ phép ngày đó (đơn APPROVED, startDate <= date <= endDate)
        long onLeaveToday = leaveRequestRepository
                .countApprovedLeaveOnDate("APPROVED", date);

        // Vắng mặt = Tổng - (Đã đến) - (Nghỉ phép) — không được âm; với ngày trong tương lai thì = 0
        long absentToday = date.isAfter(today)
                ? 0L
                : Math.max(0, totalEmployees - presentToday - onLeaveToday);

        return DashboardOverviewResponseDto.builder()
                .totalEmployees(totalEmployees)
                .presentToday(presentToday)
                .absentToday(absentToday)
                .lateToday(lateToday)
                .onLeaveToday(onLeaveToday)
                .build();
    }

    @Override
    public List<DashboardDailyTrendDto> getTrends(LocalDate startDate, LocalDate endDate) {
        LocalDate today = LocalDate.now();
        LocalDate effectiveEnd = (endDate != null) ? endDate : today;
        LocalDate effectiveStart = (startDate != null) ? startDate : effectiveEnd.minusDays(6);

        if (effectiveStart.isAfter(effectiveEnd)) {
            throw new BusinessException("Ngày bắt đầu không được lớn hơn ngày kết thúc");
        }

        if (ChronoUnit.DAYS.between(effectiveStart, effectiveEnd) > 60) {
            throw new BusinessException("Khoảng thời gian thống kê tối đa không vượt quá 60 ngày");
        }

        // Tính tổng nhân viên 1 lần ngoài vòng lặp
        long totalEmployees = userRepository.countByStatus("ACTIVE");
        List<DashboardDailyTrendDto> trends = new ArrayList<>();

        for (LocalDate d = effectiveStart; !d.isAfter(effectiveEnd); d = d.plusDays(1)) {
            LocalDateTime startOfDay = d.atStartOfDay();
            LocalDateTime startOfNextDay = d.plusDays(1).atStartOfDay();
            LocalDateTime lateThreshold = d.atTime(WORK_START);

            long presentCount = attendanceRecordRepository.countDistinctPresentUsers(startOfDay, startOfNextDay);
            long lateCount = attendanceRecordRepository.countDistinctLateUsers(startOfDay, startOfNextDay, lateThreshold);
            long onTimeCount = Math.max(0, presentCount - lateCount);
            long onLeaveCount = leaveRequestRepository.countApprovedLeaveOnDate("APPROVED", d);
            long absentCount = d.isAfter(today)
                    ? 0L
                    : Math.max(0, totalEmployees - presentCount - onLeaveCount);

            trends.add(DashboardDailyTrendDto.builder()
                    .date(d)
                    .totalEmployees(totalEmployees)
                    .presentCount(presentCount)
                    .onTimeCount(onTimeCount)
                    .lateCount(lateCount)
                    .absentCount(absentCount)
                    .onLeaveCount(onLeaveCount)
                    .build());
        }

        return trends;
    }
}
