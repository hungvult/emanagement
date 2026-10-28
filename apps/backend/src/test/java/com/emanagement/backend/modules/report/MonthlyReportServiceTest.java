package com.emanagement.backend.modules.report;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.modules.attendance.*;
import com.emanagement.backend.modules.employee.*;
import com.emanagement.backend.modules.shift.*;

@ExtendWith(MockitoExtension.class)
class MonthlyReportServiceTest {
    @Mock UserRepository users;
    @Mock EmployeeShiftRepository assignments;
    @Mock AttendanceRecordRepository attendance;
    @InjectMocks MonthlyReportService service;
    private final LocalDateTime now = LocalDateTime.of(2026, 10, 28, 12, 30);
    private final User user = User.builder().id(2L).employeeCode("EMP260002").fullName("Nhan vien").build();

    @BeforeEach
    void setup() {
        lenient().when(users.findEmployeesForReport()).thenReturn(List.of(user));
    }

    private EmployeeShift assignment(int day) {
        EmployeeShift result = new EmployeeShift();
        result.setUser(user);
        result.setAssignedDate(LocalDate.of(2026, 10, day));
        result.setStartTime(LocalTime.of(8, 0));
        result.setEndTime(LocalTime.of(17, 0));
        result.setGracePeriodMinutes(15);
        return result;
    }

    private AttendanceRecord record(int day, int hour, int minute, LocalDateTime out) {
        return AttendanceRecord.builder().user(user)
                .checkInTime(LocalDateTime.of(2026, 10, day, hour, minute)).checkOutTime(out).build();
    }

    @Test
    void totalsIncludeFutureAssignmentsButOnlyElapsedTimeForCurrentAttendance() {
        when(assignments.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                .thenReturn(List.of(assignment(27), assignment(28), assignment(30)));
        when(attendance.findForMonthlyReport(any(), any())).thenReturn(List.of(
                record(27, 8, 0, LocalDateTime.of(2026, 10, 27, 17, 0)),
                record(28, 8, 0, null)));
        var row = service.generate(2026, 10, now).employees().getFirst();
        assertEquals(27 * 60, row.assignedMinutes());
        assertEquals(13 * 60 + 30, row.actualMinutes());
        assertEquals(0, row.missingCheckoutCount());
        assertEquals(0, row.earlyCount());
    }

    @Test
    void countsEarlyCheckoutAndLateArrivalIndependentlyUsingAssignmentSnapshot() {
        when(assignments.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                .thenReturn(List.of(assignment(26), assignment(27), assignment(28)));
        when(attendance.findForMonthlyReport(any(), any())).thenReturn(List.of(
                record(26, 8, 15, LocalDateTime.of(2026, 10, 26, 17, 0)),
                record(27, 8, 16, LocalDateTime.of(2026, 10, 27, 16, 0)),
                record(28, 7, 45, null)));
        var row = service.generate(2026, 10, now).employees().getFirst();
        assertEquals(1, row.earlyCount());
        assertEquals(1, row.lateCount());
    }

    @Test
    void pastMissingCheckoutIsFlaggedAndFutureAttendanceDoesNotCount() {
        when(attendance.findForMonthlyReport(any(), any())).thenReturn(List.of(
                record(27, 8, 0, null), record(29, 8, 0, null)));
        var row = service.generate(2026, 10, now).employees().getFirst();
        assertEquals(0, row.actualMinutes());
        assertEquals(1, row.missingCheckoutCount());
    }

    @Test
    void clipsIntervalsAtMonthBoundaryAndCurrentTime() {
        AttendanceRecord previousMonth = AttendanceRecord.builder().user(user)
                .checkInTime(LocalDateTime.of(2026, 9, 30, 23, 0))
                .checkOutTime(LocalDateTime.of(2026, 10, 1, 1, 0)).build();
        when(attendance.findForMonthlyReport(any(), any())).thenReturn(List.of(previousMonth,
                record(28, 12, 0, LocalDateTime.of(2026, 10, 28, 20, 0))));
        assertEquals(90, service.generate(2026, 10, now).employees().getFirst().actualMinutes());
        verify(attendance).findForMonthlyReport(LocalDateTime.of(2026, 10, 1, 0, 0), LocalDateTime.of(2026, 11, 1, 0, 0));
    }

    @Test
    void invalidCheckoutCannotAddNegativeHoursOrEarlyDeparture() {
        when(assignments.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any())).thenReturn(List.of(assignment(27)));
        when(attendance.findForMonthlyReport(any(), any())).thenReturn(List.of(
                record(27, 8, 0, LocalDateTime.of(2026, 10, 27, 7, 0))));
        var row = service.generate(2026, 10, now).employees().getFirst();
        assertEquals(0, row.actualMinutes());
        assertEquals(0, row.earlyCount());
    }

    @Test
    void employeeWithoutActivityIsIncludedWithZeroTotals() {
        var row = service.generate(2026, 10, now).employees().getFirst();
        assertEquals(user.getId(), row.userId());
        assertEquals(0, row.assignedMinutes());
        assertEquals(0, row.actualMinutes());
    }

    @Test
    void validatesMonthAndYearBeforeQuerying() {
        assertThrows(BusinessException.class, () -> service.generate(2026, 13, now));
        assertThrows(BusinessException.class, () -> service.generate(2026, 0, now));
        assertThrows(BusinessException.class, () -> service.generate(1899, 1, now));
        verifyNoInteractions(assignments, attendance);
    }
}
