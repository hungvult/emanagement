package com.emanagement.backend.modules.report;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.modules.attendance.*;
import com.emanagement.backend.modules.employee.*;
import com.emanagement.backend.modules.shift.*;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MonthlyReportService {
    private final UserRepository users;
    private final EmployeeShiftRepository assignments;
    private final AttendanceRecordRepository attendance;

    @Transactional(readOnly = true)
    public MonthlyReportDto getMonthlyReport(int year, int month) {
        return generate(year, month, LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")));
    }

    MonthlyReportDto generate(int year, int month, LocalDateTime now) {
        if (year < 1900 || year > 9999 || month < 1 || month > 12) {
            throw new BusinessException("Tháng hoặc năm báo cáo không hợp lệ");
        }
        YearMonth selected = YearMonth.of(year, month);
        LocalDateTime start = selected.atDay(1).atStartOfDay();
        LocalDateTime end = selected.plusMonths(1).atDay(1).atStartOfDay();
        List<EmployeeShift> shifts = assignments.findByAssignedDateBetweenOrderByAssignedDateAsc(
                selected.atDay(1), selected.atEndOfMonth());
        Map<Long, List<EmployeeShift>> shiftsByUser = shifts.stream()
                .collect(Collectors.groupingBy(s -> s.getUser().getId()));
        Map<Long, List<AttendanceRecord>> recordsByUser = attendance.findForMonthlyReport(start, end).stream()
                .collect(Collectors.groupingBy(a -> a.getUser().getId()));
        List<MonthlyReportDto.EmployeeRow> rows = new ArrayList<>();
        for (User user : users.findEmployeesForReport()) {
            List<EmployeeShift> personalShifts = shiftsByUser.getOrDefault(user.getId(), List.of());
            long assignedMinutes = personalShifts.stream()
                    .mapToLong(s -> Math.max(0, Duration.between(s.getStartTime(), s.getEndTime()).toMinutes())).sum();
            Map<LocalDate, EmployeeShift> byDate = personalShifts.stream()
                    .collect(Collectors.toMap(EmployeeShift::getAssignedDate, s -> s, (a, b) -> a));
            long seconds = 0;
            int early = 0, late = 0, missing = 0;
            for (AttendanceRecord record : recordsByUser.getOrDefault(user.getId(), List.of())) {
                LocalDateTime in = record.getCheckInTime();
                if (in == null || in.isAfter(now)) continue;
                LocalDateTime out = record.getCheckOutTime();
                if (out == null) {
                    if (in.toLocalDate().equals(now.toLocalDate())) out = now;
                    else missing++;
                }
                if (out != null) {
                    LocalDateTime from = in.isBefore(start) ? start : in;
                    LocalDateTime to = out.isAfter(now) ? now : out;
                    if (to.isAfter(end)) to = end;
                    seconds += Math.max(0, Duration.between(from, to).getSeconds());
                }
                if (in.isBefore(start) || !in.isBefore(end)) continue;
                EmployeeShift assigned = byDate.get(in.toLocalDate());
                Shift fallback = record.getShift();
                if (assigned == null && fallback == null) continue;
                LocalTime shiftStart = assigned != null ? assigned.getStartTime() : fallback.getStartTime();
                Integer grace = assigned != null ? assigned.getGracePeriodMinutes() : fallback.getGracePeriodMinutes();
                LocalDateTime expected = in.toLocalDate().atTime(shiftStart);
                LocalTime shiftEnd = assigned != null ? assigned.getEndTime() : fallback.getEndTime();
                LocalDateTime checkedOut = record.getCheckOutTime();
                if (checkedOut != null && !checkedOut.isBefore(in) && !checkedOut.isAfter(now)
                        && checkedOut.isBefore(in.toLocalDate().atTime(shiftEnd))) early++;
                if (in.isAfter(expected.plusMinutes(grace == null ? 15 : grace))) late++;
            }
            rows.add(new MonthlyReportDto.EmployeeRow(user.getId(), user.getEmployeeCode(), user.getFullName(),
                    assignedMinutes, seconds / 60, early, late, missing));
        }
        return new MonthlyReportDto(year, month, now, rows);
    }
}
