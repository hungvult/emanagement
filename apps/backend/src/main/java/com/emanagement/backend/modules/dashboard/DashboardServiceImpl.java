package com.emanagement.backend.modules.dashboard;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.modules.alert.AnomalyAlertRepository;
import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.dashboard.dto.DashboardStatsDto;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.kiosk.KioskRepository;
import com.emanagement.backend.modules.leave.LeaveRequestRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {
    private final UserRepository userRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final LeaveRequestRepository leaveRequestRepository;
    private final AnomalyAlertRepository anomalyAlertRepository;
    private final KioskRepository kioskRepository;

    @Override
    @Transactional(readOnly = true)
    public DashboardStatsDto getDashboardStats() {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        long totalEmployees = userRepository.count();
        long activeEmployees = userRepository.countByStatus("ACTIVE");

        long todayCheckIns = attendanceRecordRepository.countByCheckInTimeBetween(startOfDay, endOfDay);
        long todayOnTime = attendanceRecordRepository.countByStatusAndCheckInTimeBetween("ON_TIME", startOfDay, endOfDay);
        long todayLate = attendanceRecordRepository.countByStatusAndCheckInTimeBetween("LATE", startOfDay, endOfDay);

        long pendingLeaveRequests = leaveRequestRepository.countByStatus("PENDING");
        long unresolvedAlerts = anomalyAlertRepository.countByIsResolved(false);
        long activeKiosks = kioskRepository.countByStatus("ACTIVE");

        return DashboardStatsDto.builder()
                .totalEmployees(totalEmployees)
                .activeEmployees(activeEmployees)
                .todayCheckIns(todayCheckIns)
                .todayOnTime(todayOnTime)
                .todayLate(todayLate)
                .pendingLeaveRequests(pendingLeaveRequests)
                .unresolvedAlerts(unresolvedAlerts)
                .activeKiosks(activeKiosks)
                .reportDate(today)
                .build();
    }
}
