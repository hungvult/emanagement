package com.emanagement.backend.modules.shift;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.leave.LeaveRequest;
import com.emanagement.backend.modules.leave.LeaveRequestRepository;
import com.emanagement.backend.modules.notification.NotificationService;
import com.emanagement.backend.modules.shift.dto.*;

@ExtendWith(MockitoExtension.class)
class ShiftLeaveTest {
    @Mock ShiftRepository shifts;
    @Mock EmployeeShiftRepository assignments;
    @Mock UserRepository users;
    @Mock NotificationService notifications;
    @Mock LeaveRequestRepository leaves;
    @Mock AttendanceRecordRepository attendance;
    @InjectMocks ShiftServiceImpl service;

    @Test
    void scheduleIncludesLeaveWithoutAnAssignedShift() {
        LocalDate day = LocalDate.now().plusDays(7);
        var leave = new ScheduleLeaveDto(42L, day, day.plusDays(2));
        when(leaves.findApprovedScheduleLeaves(day, day.plusDays(6))).thenReturn(List.of(leave));
        assertEquals(List.of(leave), service.getScheduleLeaves(day, day.plusDays(6)));
        verifyNoInteractions(assignments);
    }

    @Test
    void rejectsInvalidLeaveScheduleRanges() {
        LocalDate day = LocalDate.now();
        assertThrows(BusinessException.class, () -> service.getScheduleLeaves(day, day.minusDays(1)));
        assertThrows(BusinessException.class, () -> service.getScheduleLeaves(day, day.plusDays(93)));
        verifyNoInteractions(leaves);
    }

    @Test
    void approvedLeaveBlocksSingleBulkAndCopiedAssignments() {
        LocalDate day = LocalDate.now().plusDays(7);
        User user = User.builder().id(42L).status("ACTIVE").build();
        Shift shift = new Shift();
        shift.setId(7L);
        shift.setActive(true);
        when(shifts.findById(7L)).thenReturn(Optional.of(shift));
        when(users.findById(42L)).thenReturn(Optional.of(user));
        when(users.findAllById(any())).thenReturn(List.of(user));
        when(leaves.findApprovedOverlapping(any(), eq(day), eq(day))).thenReturn(List.of(
                LeaveRequest.builder().user(user).startDate(day).endDate(day).status("APPROVED").build()));

        assertThrows(BusinessException.class, () -> service.assignShift(new AssignShiftDto(42L, 7L, day)));
        BulkAssignDto bulk = new BulkAssignDto(List.of(42L), 7L, day, day,
                Set.of(day.getDayOfWeek()), true, false);
        assertEquals(1, service.bulkAssign(bulk).getSkipped());

        EmployeeShift source = new EmployeeShift();
        source.setUser(user);
        source.setShift(shift);
        source.setAssignedDate(day.minusDays(7));
        when(assignments.findByUserIdInAndAssignedDateBetween(List.of(42L), day.minusDays(7), day.minusDays(1)))
                .thenReturn(List.of(source));
        CopyWeekDto copy = new CopyWeekDto();
        copy.setUserIds(List.of(42L));
        copy.setSourceWeekStart(day.minusDays(7));
        copy.setTargetWeekStart(day);
        copy.setOverwrite(true);
        assertEquals(1, service.copyWeek(copy).getSkipped());
        verify(assignments, never()).saveAll(any());
        verifyNoInteractions(notifications);
    }
}
