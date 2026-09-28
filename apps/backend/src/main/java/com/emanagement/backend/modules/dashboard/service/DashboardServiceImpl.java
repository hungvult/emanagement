package com.emanagement.backend.modules.dashboard.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import org.springframework.stereotype.Service;

import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.dashboard.dto.DashboardOverviewResponseDto;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.leave.LeaveRequestRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final UserRepository userRepository;
    private final LeaveRequestRepository leaveRequestRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;

    // Giờ bắt đầu tính là đi muộn (8:30)
    private static final LocalTime WORK_START = LocalTime.of(8, 30);

    @Override
    public DashboardOverviewResponseDto getOverview() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();                  // 00:00:00
        LocalDateTime startOfNextDay = today.plusDays(1).atStartOfDay(); // 00:00:00 ngày mai
        LocalDateTime lateThreshold = today.atTime(WORK_START);           // 08:30:00 hôm nay

        // Tổng nhân viên đang hoạt động (status = "ACTIVE")
        long totalEmployees = userRepository.countByStatus("ACTIVE");

        // Số nhân viên đã check-in hôm nay (checkInTime trong [startOfDay, startOfNextDay))
        long presentToday = attendanceRecordRepository
                .countDistinctPresentUsers(startOfDay, startOfNextDay);

        // Số nhân viên đi muộn hôm nay (check-in đầu tiên sau 08:30)
        long lateToday = attendanceRecordRepository
                .countDistinctLateUsers(startOfDay, startOfNextDay, lateThreshold);

        // Số nhân viên nghỉ phép hôm nay (đơn APPROVED, startDate <= today <= endDate)
        long onLeaveToday = leaveRequestRepository
                .countApprovedLeaveOnDate("APPROVED", today);

        // Vắng mặt = Tổng - (Đã đến) - (Nghỉ phép) — không được âm
        long absentToday = Math.max(0, totalEmployees - presentToday - onLeaveToday);

        return DashboardOverviewResponseDto.builder()
                .totalEmployees(totalEmployees)
                .presentToday(presentToday)
                .absentToday(absentToday)
                .lateToday(lateToday)
                .onLeaveToday(onLeaveToday)
                .build();
    }
}
