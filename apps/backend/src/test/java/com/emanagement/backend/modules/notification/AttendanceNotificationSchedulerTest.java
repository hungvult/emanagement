package com.emanagement.backend.modules.notification;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import com.emanagement.backend.modules.attendance.*;
import com.emanagement.backend.modules.employee.*;
import com.emanagement.backend.modules.shift.*;
import com.emanagement.backend.modules.leave.*;
import com.emanagement.backend.modules.face.*;
import com.emanagement.backend.modules.bulkimport.*;

@ExtendWith(MockitoExtension.class)
class AttendanceNotificationSchedulerTest {
    @Mock EmployeeShiftRepository shifts;
    @Mock AttendanceRecordRepository attendance;
    @Mock LeaveRequestRepository leaves;
    @Mock UserRepository users;
    @Mock FaceDataRepository faces;
    @Mock NotificationService notifications;
    @Mock BulkImportJobRepository jobs;
    @Mock ImportNotificationService imports;
    @InjectMocks AttendanceNotificationScheduler scheduler;
    private final LocalDate day = LocalDate.of(2026, 10, 29);
    private User employee;
    private Shift shift;
    private EmployeeShift assignment;

    @BeforeEach
    void setup() {
        employee = User.builder().id(2L).employeeCode("EMP002").fullName("Nhan vien").status("ACTIVE").build();
        shift = Shift.builder().id(7L).startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(17, 0)).build();
        assignment = new EmployeeShift();
        assignment.setId(20L); assignment.setUser(employee); assignment.setAssignedDate(day);
        assignment.applyShift(shift);
        lenient().when(shifts.findByAssignedDateBetweenOrderByAssignedDateAsc(day, day)).thenReturn(List.of(assignment));
    }

    @Test
    void upcomingReminderOnlyRunsInItsWindow() {
        scheduler.process(day.atTime(7, 44));
        verify(notifications, never()).notifyOnce(any(), any(), any(), any(), any(), any(), any(), any());
        scheduler.process(day.atTime(7, 45));
        verify(notifications).notifyOnce(eq(employee), eq(NotificationType.SHIFT_REMINDER), any(), any(), eq(20L),
                eq("/my-schedule"), eq("upcoming:20"), eq(day.atTime(8, 0)));
    }

    @Test
    void noReminderForApprovedLeave() {
        when(leaves.findApprovedOverlapping(any(), eq(day), eq(day))).thenReturn(List.of(
                LeaveRequest.builder().user(employee).startDate(day).endDate(day).status("APPROVED").build()));
        scheduler.process(day.atTime(9, 0));
        verify(notifications, never()).notifyOnce(any(), any(), any(), any(), any(), any(), any(), any());
        verify(notifications).dismiss(argThat(keys -> keys.contains("missing-in:20")));
    }

    @Test
    void checkinReminderUsesGraceAndIsDismissedWhenCheckedIn() {
        scheduler.process(day.atTime(8, 15));
        verify(notifications, never()).notifyOnce(any(), any(), any(), any(), any(), any(), any(), any());
        scheduler.process(day.atTime(8, 16));
        verify(notifications).notifyOnce(eq(employee), eq(NotificationType.MISSING_CHECK_IN), any(), any(), eq(20L),
                contains("startDate=2026-10-29"), eq("missing-in:20"), eq(day.plusDays(1).atStartOfDay()));
        clearInvocations(notifications);
        when(attendance.findByUserIdInAndCheckInTimeBetween(any(), any(), any())).thenReturn(List.of(
                AttendanceRecord.builder().user(employee).shift(shift).checkInTime(day.atTime(8, 0)).build()));
        scheduler.process(day.atTime(9, 0));
        verify(notifications, never()).notifyOnce(any(), any(), any(), any(), any(), any(), any(), any());
        verify(notifications).dismiss(List.of("upcoming:20", "missing-in:20"));
    }

    @Test
    void checkoutReminderWaitsThirtyMinutesAndNotifiesEmployeeAndAdmin() {
        User admin = User.builder().id(1L).build();
        when(users.findActiveAdmins()).thenReturn(List.of(admin));
        AttendanceRecord record = AttendanceRecord.builder().user(employee).shift(shift).checkInTime(day.atTime(8, 0)).build();
        when(attendance.findByUserIdInAndCheckInTimeBetween(any(), any(), any())).thenReturn(List.of(record));
        scheduler.process(day.atTime(17, 29));
        verify(notifications, never()).notifyOnce(any(), any(), any(), any(), any(), any(), any(), any());
        scheduler.process(day.atTime(17, 30));
        verify(notifications).notifyOnce(eq(employee), eq(NotificationType.MISSING_CHECK_OUT), any(), any(), any(), any(), eq("missing-out:20"), any());
        verify(notifications).notifyOnce(eq(admin), eq(NotificationType.MISSING_CHECK_OUT), any(), any(), any(), any(), eq("missing-out:20:admin:1"), any());
        clearInvocations(notifications);
        record.setCheckOutTime(day.atTime(17, 20));
        scheduler.process(day.atTime(17, 31));
        verify(notifications, never()).notifyOnce(any(), any(), any(), any(), any(), any(), any(), any());
        verify(notifications).dismiss(List.of("missing-out:20"));
    }

    @Test
    void summaryIsAggregatedAndRegistrationReminderSkipsRegisteredPeople() {
        when(attendance.findByUserIdInAndCheckInTimeBetween(any(), any(), any())).thenReturn(List.of(
                AttendanceRecord.builder().user(employee).shift(shift).checkInTime(day.atTime(8, 16)).checkOutTime(day.atTime(16, 0)).build()));
        scheduler.summarize(day.atTime(18, 30));
        verify(notifications).notifyAdminsOnce(eq(NotificationType.DAILY_ATTENDANCE_SUMMARY), any(),
                contains("1 lượt đi muộn, 1 lượt về sớm"), isNull(), any(), eq("daily:2026-10-29"), isNull());
        when(users.findActiveEmployees()).thenReturn(List.of(employee));
        when(faces.findRegisteredUserIds()).thenReturn(List.of(2L));
        scheduler.remindFaceRegistration();
        verify(notifications, never()).notifyOnce(any(), eq(NotificationType.FACE_REGISTRATION_REQUIRED), any(), any(), any(), any(), any(), any());
    }
}
