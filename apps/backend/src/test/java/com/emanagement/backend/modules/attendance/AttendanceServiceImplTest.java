package com.emanagement.backend.modules.attendance;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.lang.reflect.Method;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.attendance.dto.AttendanceHistoryDto;
import com.emanagement.backend.modules.attendance.dto.ManualAttendanceRequestDto;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.kiosk.Kiosk;
import com.emanagement.backend.modules.shift.EmployeeShift;
import com.emanagement.backend.modules.shift.EmployeeShiftRepository;
import com.emanagement.backend.modules.shift.Shift;
import com.emanagement.backend.modules.shift.ShiftRepository;

import jakarta.persistence.EntityManager;

@ExtendWith(MockitoExtension.class)
class AttendanceServiceImplTest {

    @Mock
    private AttendanceRecordRepository attendanceRecordRepository;

    @Mock
    private EmployeeShiftRepository employeeShiftRepository;

    @Mock
    private ShiftRepository shiftRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private StorageService storageService;

    @Mock
    private EntityManager entityManager;

    @InjectMocks
    private AttendanceServiceImpl attendanceService;

    private User user1;
    private User user2;
    private Shift standardShift;
    private Shift overnightShift;
    private Kiosk kiosk;

    @BeforeEach
    void setUp() {
        user1 = User.builder()
                .id(1L)
                .employeeCode("EMP001")
                .fullName("Nguyễn Văn A")
                .build();

        user2 = User.builder()
                .id(2L)
                .employeeCode("EMP002")
                .fullName("Trần Thị B")
                .build();

        standardShift = Shift.builder()
                .id(10L)
                .shiftCode("SHIFT-001")
                .name("Ca hành chính")
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(17, 0))
                .gracePeriodMinutes(15)
                .build();

        overnightShift = Shift.builder()
                .id(20L)
                .shiftCode("SHIFT-NIGHT")
                .name("Ca đêm")
                .startTime(LocalTime.of(22, 0))
                .endTime(LocalTime.of(6, 0))
                .gracePeriodMinutes(15)
                .build();

        kiosk = new Kiosk();
        kiosk.setId(100L);
        kiosk.setName("Trạm Kiosk Cổng 1");
    }

    // =========================================================================
    // 1. ST5-04: getAllRecords with Search Parameter
    // =========================================================================

    @Nested
    @DisplayName("ST5-04: getAllRecords with Search")
    class GetAllRecordsSearchTests {

        @Test
        @DisplayName("getAllRecords with search filters both attended records and unattended NO_DATA shifts")
        void getAllRecords_WithSearch_FiltersAttendedAndUnattended() {
            LocalDate start = LocalDate.of(2026, 10, 1);
            LocalDate end = LocalDate.of(2026, 10, 24);
            String search = "Nguyễn";

            // Attended record for user 1 (Nguyễn Văn A)
            AttendanceRecord attendedRecord = AttendanceRecord.builder()
                    .id(101L)
                    .user(user1)
                    .shift(standardShift)
                    .kiosk(kiosk)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 7, 55))
                    .checkOutTime(LocalDateTime.of(2026, 10, 24, 17, 5))
                    .status("ON_TIME")
                    .build();

            when(attendanceRecordRepository.findAllWithExportFilters(
                    eq(true), eq(start.atStartOfDay()),
                    eq(true), eq(end.plusDays(1).atStartOfDay()),
                    eq(false), eq(""),
                    eq(false), isNull(),
                    eq(true), eq("Nguyễn"),
                    eq(PageRequest.of(0, 1000))))
                    .thenReturn(new PageImpl<>(List.of(attendedRecord)));

            // Scheduled shifts: user 1 (matching name) and user 2 (non-matching name)
            EmployeeShift es1 = new EmployeeShift();
            es1.setId(501L);
            es1.setUser(user1);
            es1.setShift(standardShift);
            es1.setShiftName("Ca hành chính");
            es1.setAssignedDate(LocalDate.of(2026, 10, 23));

            EmployeeShift es2 = new EmployeeShift();
            es2.setId(502L);
            es2.setUser(user2);
            es2.setShift(standardShift);
            es2.setShiftName("Ca hành chính");
            es2.setAssignedDate(LocalDate.of(2026, 10, 23));

            when(employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                    .thenReturn(List.of(es1, es2));
            when(attendanceRecordRepository.findByUserIdInAndCheckInTimeBetween(any(), any(), any()))
                    .thenReturn(Collections.emptyList());

            PageResponse<AttendanceHistoryDto> result = attendanceService.getAllRecords(0, 10, start, end, null, null, search);

            assertNotNull(result);
            assertEquals(2, result.getContent().size());

            // Check that user2 ("Trần Thị B") was filtered out from unattended list
            boolean containsUser2 = result.getContent().stream()
                    .anyMatch(r -> "EMP002".equals(r.getEmployeeCode()));
            assertFalse(containsUser2, "Unattended shifts for non-matching users must be excluded by search keyword");

            // Check that user1 ("Nguyễn Văn A") is present in attended and unattended entries
            boolean allMatchNguyễn = result.getContent().stream()
                    .allMatch(r -> r.getFullName().contains("Nguyễn"));
            assertTrue(allMatchNguyễn, "All returned records must match the search keyword");
        }

        @Test
        @DisplayName("getAllRecords with search filters unattended shifts by employeeCode")
        void getAllRecords_WithSearch_FiltersUnattendedShiftsByEmployeeCode() {
            LocalDate start = LocalDate.of(2026, 10, 1);
            LocalDate end = LocalDate.of(2026, 10, 24);
            String search = "EMP002";

            when(attendanceRecordRepository.findAllWithExportFilters(
                    anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                    anyBoolean(), any(), anyBoolean(), eq("EMP002"), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(Collections.emptyList()));

            EmployeeShift es1 = new EmployeeShift();
            es1.setId(501L);
            es1.setUser(user1); // EMP001
            es1.setShift(standardShift);
            es1.setAssignedDate(LocalDate.of(2026, 10, 23));

            EmployeeShift es2 = new EmployeeShift();
            es2.setId(502L);
            es2.setUser(user2); // EMP002
            es2.setShift(standardShift);
            es2.setAssignedDate(LocalDate.of(2026, 10, 23));

            when(employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                    .thenReturn(List.of(es1, es2));
            when(attendanceRecordRepository.findByUserIdInAndCheckInTimeBetween(any(), any(), any()))
                    .thenReturn(Collections.emptyList());

            PageResponse<AttendanceHistoryDto> result = attendanceService.getAllRecords(0, 10, start, end, null, null, search);

            assertNotNull(result);
            assertEquals(1, result.getContent().size());
            assertEquals("EMP002", result.getContent().get(0).getEmployeeCode());
            assertEquals(-502L, result.getContent().get(0).getId());
        }

        @Test
        @DisplayName("getAllRecords with status=NO_DATA and search filters unattended shifts")
        void getAllRecords_StatusNoData_WithSearch_ReturnsMatchingUnattendedShiftsOnly() {
            LocalDate start = LocalDate.of(2026, 10, 1);
            LocalDate end = LocalDate.of(2026, 10, 24);

            EmployeeShift es1 = new EmployeeShift();
            es1.setId(501L);
            es1.setUser(user1);
            es1.setShift(standardShift);
            es1.setAssignedDate(LocalDate.of(2026, 10, 22));

            EmployeeShift es2 = new EmployeeShift();
            es2.setId(502L);
            es2.setUser(user2);
            es2.setShift(standardShift);
            es2.setAssignedDate(LocalDate.of(2026, 10, 22));

            when(employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                    .thenReturn(List.of(es1, es2));
            when(attendanceRecordRepository.findByUserIdInAndCheckInTimeBetween(any(), any(), any()))
                    .thenReturn(Collections.emptyList());

            PageResponse<AttendanceHistoryDto> result = attendanceService.getAllRecords(0, 10, start, end, "NO_DATA", null, "Trần");

            assertNotNull(result);
            assertEquals(1, result.getContent().size());
            assertEquals("Trần Thị B", result.getContent().get(0).getFullName());
            assertEquals("NO_DATA", result.getContent().get(0).getStatus());
        }

        @Test
        @DisplayName("getAllRecords with specific status and search delegates to findAllWithExportFilters")
        void getAllRecords_StatusSpecific_WithSearch_CallsFindAllWithExportFilters() {
            LocalDate start = LocalDate.of(2026, 10, 1);
            LocalDate end = LocalDate.of(2026, 10, 24);
            AttendanceRecord rec = AttendanceRecord.builder()
                    .id(200L)
                    .user(user1)
                    .shift(standardShift)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 30))
                    .status("LATE")
                    .build();

            when(attendanceRecordRepository.findAllWithExportFilters(
                    eq(true), eq(start.atStartOfDay()),
                    eq(true), eq(end.plusDays(1).atStartOfDay()),
                    eq(true), eq("LATE"),
                    eq(true), eq(10L),
                    eq(true), eq("EMP001"),
                    eq(PageRequest.of(0, 10))))
                    .thenReturn(new PageImpl<>(List.of(rec), PageRequest.of(0, 10), 1));

            PageResponse<AttendanceHistoryDto> result = attendanceService.getAllRecords(0, 10, start, end, "late", 10L, "EMP001");

            assertNotNull(result);
            assertEquals(1, result.getContent().size());
            assertEquals("LATE", result.getContent().get(0).getStatus());
            verify(attendanceRecordRepository).findAllWithExportFilters(
                    eq(true), eq(start.atStartOfDay()),
                    eq(true), eq(end.plusDays(1).atStartOfDay()),
                    eq(true), eq("LATE"),
                    eq(true), eq(10L),
                    eq(true), eq("EMP001"),
                    eq(PageRequest.of(0, 10)));
        }

        @Test
        @DisplayName("getAllRecords with null search passes null searchParam without filtering")
        void getAllRecords_WhenSearchIsNull_CallsStandardMethods() {
            when(employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.findAllWithFilters(anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any(), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(Collections.emptyList()));

            PageResponse<AttendanceHistoryDto> result = attendanceService.getAllRecords(0, 10, null, null, null, null, null);

            assertNotNull(result);
            verify(attendanceRecordRepository).findAllWithFilters(anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any(), any(PageRequest.class));
            verify(attendanceRecordRepository, never()).findAllWithExportFilters(anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(), anyBoolean(), any(), anyBoolean(), anyString(), any());
        }

        @Test
        @DisplayName("getAllRecords with search delegates to findAllWithExportFilters when unattended list is empty")
        void getAllRecords_WithSearch_WhenUnattendedIsEmpty_CallsFindAllWithExportFilters() {
            LocalDate start = LocalDate.of(2026, 10, 1);
            LocalDate end = LocalDate.of(2026, 10, 24);
            String search = "EMP001";

            AttendanceRecord rec = AttendanceRecord.builder()
                    .id(101L)
                    .user(user1)
                    .shift(standardShift)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 7, 55))
                    .status("ON_TIME")
                    .build();

            when(employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.findAllWithExportFilters(
                    eq(true), eq(start.atStartOfDay()),
                    eq(true), eq(end.plusDays(1).atStartOfDay()),
                    eq(false), eq(""),
                    eq(false), isNull(),
                    eq(true), eq(search),
                    eq(PageRequest.of(0, 10))))
                    .thenReturn(new PageImpl<>(List.of(rec), PageRequest.of(0, 10), 1));

            PageResponse<AttendanceHistoryDto> result = attendanceService.getAllRecords(0, 10, start, end, null, null, search);

            assertNotNull(result);
            assertEquals(1, result.getContent().size());
            assertEquals("EMP001", result.getContent().get(0).getEmployeeCode());
            verify(attendanceRecordRepository).findAllWithExportFilters(
                    eq(true), eq(start.atStartOfDay()),
                    eq(true), eq(end.plusDays(1).atStartOfDay()),
                    eq(false), eq(""),
                    eq(false), isNull(),
                    eq(true), eq(search),
                    eq(PageRequest.of(0, 10)));
        }

        @Test
        @DisplayName("getAllRecords trims leading and trailing whitespace from search keyword")
        void getAllRecords_WithSearch_TrimsWhitespace() {
            when(employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.findAllWithExportFilters(
                    anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                    anyBoolean(), any(), anyBoolean(), eq("EMP001"), any(PageRequest.class)))
                    .thenReturn(new PageImpl<>(Collections.emptyList()));

            PageResponse<AttendanceHistoryDto> result = attendanceService.getAllRecords(0, 10, null, null, null, null, "  EMP001  ");

            assertNotNull(result);
            verify(attendanceRecordRepository).findAllWithExportFilters(
                    anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                    anyBoolean(), any(), anyBoolean(), eq("EMP001"), any(PageRequest.class));
        }

        @Test
        @DisplayName("getAllRecords with search filters both attended records and unattended shifts by employee code")
        void getAllRecords_WithSearch_FiltersAttendedAndUnattendedByEmployeeCode() {
            LocalDate start = LocalDate.of(2026, 10, 1);
            LocalDate end = LocalDate.of(2026, 10, 24);
            String search = "EMP001";

            AttendanceRecord attended1 = AttendanceRecord.builder()
                    .id(101L)
                    .user(user1)
                    .shift(standardShift)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 7, 55))
                    .status("ON_TIME")
                    .build();

            when(attendanceRecordRepository.findAllWithExportFilters(
                    eq(true), eq(start.atStartOfDay()),
                    eq(true), eq(end.plusDays(1).atStartOfDay()),
                    eq(false), eq(""),
                    eq(false), isNull(),
                    eq(true), eq("EMP001"),
                    eq(PageRequest.of(0, 1000))))
                    .thenReturn(new PageImpl<>(List.of(attended1)));

            EmployeeShift es1 = new EmployeeShift();
            es1.setId(501L);
            es1.setUser(user1);
            es1.setShift(standardShift);
            es1.setAssignedDate(LocalDate.of(2026, 10, 23));

            EmployeeShift es2 = new EmployeeShift();
            es2.setId(502L);
            es2.setUser(user2);
            es2.setShift(standardShift);
            es2.setAssignedDate(LocalDate.of(2026, 10, 23));

            when(employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                    .thenReturn(List.of(es1, es2));
            when(attendanceRecordRepository.findByUserIdInAndCheckInTimeBetween(any(), any(), any()))
                    .thenReturn(Collections.emptyList());

            PageResponse<AttendanceHistoryDto> result = attendanceService.getAllRecords(0, 10, start, end, null, null, search);

            assertNotNull(result);
            assertEquals(2, result.getContent().size());
            assertTrue(result.getContent().stream().allMatch(r -> "EMP001".equals(r.getEmployeeCode())));
        }
    }

    // =========================================================================
    // 2. ST5-05: createManualRecord
    // =========================================================================

    @Nested
    @DisplayName("ST5-05: createManualRecord")
    class CreateManualRecordTests {

        @Test
        @DisplayName("createManualRecord successfully creates record and auto-infers ON_TIME status")
        void createManualRecord_Success_AutoInfersOnTime() {
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 10); // Grace is until 8:15
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 17, 10); // Shift ends at 17:00

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .workDate(LocalDate.of(2026, 10, 24))
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .status(null)
                    .note("Giải trình quên quẹt thẻ")
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> {
                AttendanceRecord r = inv.getArgument(0);
                r.setId(301L);
                return r;
            });

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals(301L, result.getId());
            assertEquals("ON_TIME", result.getStatus());
            assertEquals(inTime, result.getCheckInTime());
            assertEquals(outTime, result.getCheckOutTime());
            assertEquals("Ca hành chính", result.getShiftName());
            verify(attendanceRecordRepository).save(any(AttendanceRecord.class));
        }

        @Test
        @DisplayName("createManualRecord auto-infers LATE status when check-in is after grace period")
        void createManualRecord_Success_AutoInfersLate() {
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 20); // After grace 8:15
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 17, 30);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .workDate(LocalDate.of(2026, 10, 24))
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("LATE", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord auto-infers EARLY_LEAVE status when check-out is before shift end")
        void createManualRecord_Success_AutoInfersEarlyLeave() {
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 0); // On time
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 16, 30); // Shift ends at 17:00

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .workDate(LocalDate.of(2026, 10, 24))
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("EARLY_LEAVE", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord auto-infers ON_TIME for overnight shift across midnight")
        void createManualRecord_Success_OvernightShift_AutoInfersOnTime() {
            LocalDate workDate = LocalDate.of(2026, 10, 24);
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 22, 10); // Start 22:00 + grace 15m = 22:15
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 25, 6, 5); // Scheduled end 06:00 next day

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(20L)
                    .workDate(workDate)
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(20L)).thenReturn(Optional.of(overnightShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("ON_TIME", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord auto-infers EARLY_LEAVE for overnight shift when checkout before scheduled end")
        void createManualRecord_Success_OvernightShift_AutoInfersEarlyLeave() {
            LocalDate workDate = LocalDate.of(2026, 10, 24);
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 22, 5);
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 25, 5, 45); // Before 06:00

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(20L)
                    .workDate(workDate)
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(20L)).thenReturn(Optional.of(overnightShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("EARLY_LEAVE", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord preserves explicitly requested status in DTO")
        void createManualRecord_Success_PreservesExplicitStatus() {
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 0);
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 17, 0);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .status("EXCUSED")
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("EXCUSED", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord updates existing record of same shift on that day")
        void createManualRecord_UpdatesExistingRecordOfSameShiftOnSameDay() {
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 0);
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 17, 0);

            AttendanceRecord existingRecord = AttendanceRecord.builder()
                    .id(777L)
                    .user(user1)
                    .shift(standardShift)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 30))
                    .status("LATE")
                    .build();

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .workDate(LocalDate.of(2026, 10, 24))
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(List.of(existingRecord));
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals(777L, result.getId(), "Should update the existing record with id 777");
            assertEquals("ON_TIME", result.getStatus());
            assertEquals(inTime, existingRecord.getCheckInTime());
            assertEquals(outTime, existingRecord.getCheckOutTime());
            verify(attendanceRecordRepository).save(existingRecord);
        }

        @Test
        @DisplayName("createManualRecord does not overwrite record of different shift on same day")
        void createManualRecord_DoesNotOverwriteRecordOfDifferentShiftOnSameDay() {
            // Existing record is for Shift 10 (standardShift)
            AttendanceRecord existingDayShift = AttendanceRecord.builder()
                    .id(111L)
                    .user(user1)
                    .shift(standardShift)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .status("ON_TIME")
                    .build();

            // Creating record for Shift 20 (overnightShift)
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(20L)
                    .workDate(LocalDate.of(2026, 10, 24))
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 22, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 25, 6, 0))
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(20L)).thenReturn(Optional.of(overnightShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(List.of(existingDayShift));
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> {
                AttendanceRecord saved = inv.getArgument(0);
                assertNotEquals(111L, saved.getId(), "Must not overwrite existing shift 10 record");
                saved.setId(222L);
                return saved;
            });

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals(222L, result.getId());
            assertEquals("Ca đêm", result.getShiftName());
        }

        @Test
        @DisplayName("createManualRecord throws BusinessException when checkOutTime is before checkInTime")
        void createManualRecord_ThrowsBusinessException_WhenCheckOutBeforeCheckIn() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 17, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.createManualRecord(dto));
            assertEquals("Thời gian ra ca phải sau thời gian vào ca", ex.getMessage());
            verify(attendanceRecordRepository, never()).save(any());
        }

        @Test
        @DisplayName("createManualRecord throws BusinessException when checkOutTime equals checkInTime")
        void createManualRecord_ThrowsBusinessException_WhenCheckOutEqualsCheckIn() {
            LocalDateTime sameTime = LocalDateTime.of(2026, 10, 24, 8, 0);
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .checkInTime(sameTime)
                    .checkOutTime(sameTime)
                    .build();

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.createManualRecord(dto));
            assertEquals("Thời gian ra ca phải sau thời gian vào ca", ex.getMessage());
        }

        @Test
        @DisplayName("createManualRecord throws BusinessException when dto is null")
        void createManualRecord_ThrowsBusinessException_WhenDtoIsNull() {
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.createManualRecord(null));
            assertEquals("Dữ liệu chấm công không được để trống", ex.getMessage());
        }

        @Test
        @DisplayName("createManualRecord throws BusinessException when checkInTime is null")
        void createManualRecord_ThrowsBusinessException_WhenCheckInIsNull() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .checkInTime(null)
                    .build();

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.createManualRecord(dto));
            assertEquals("Thời gian vào ca không được để trống", ex.getMessage());
        }

        @Test
        @DisplayName("createManualRecord throws BusinessException when userId is null")
        void createManualRecord_ThrowsBusinessException_WhenUserIdIsNull() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(null)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.createManualRecord(dto));
            assertEquals("ID nhân viên không được để trống", ex.getMessage());
        }

        @Test
        @DisplayName("createManualRecord throws ResourceNotFoundException when user not found")
        void createManualRecord_ThrowsResourceNotFoundException_WhenUserNotFound() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(999L)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
                    () -> attendanceService.createManualRecord(dto));
            assertTrue(ex.getMessage().contains("999"));
        }

        @Test
        @DisplayName("createManualRecord throws ResourceNotFoundException when shiftId provided but not found")
        void createManualRecord_ThrowsResourceNotFoundException_WhenShiftNotFound() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(999L)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(999L)).thenReturn(Optional.empty());

            ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
                    () -> attendanceService.createManualRecord(dto));
            assertTrue(ex.getMessage().contains("999"));
        }

        @Test
        @DisplayName("createManualRecord falls back to EmployeeShift when shiftId is not provided")
        void createManualRecord_FallbackShift_FromEmployeeShift() {
            LocalDate date = LocalDate.of(2026, 10, 24);
            LocalDateTime inTime = date.atTime(8, 0);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(null)
                    .workDate(date)
                    .checkInTime(inTime)
                    .build();

            EmployeeShift es = new EmployeeShift();
            es.setShift(standardShift);

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(employeeShiftRepository.findByUserIdAndAssignedDate(1L, date)).thenReturn(Optional.of(es));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("Ca hành chính", result.getShiftName());
        }

        @Test
        @DisplayName("createManualRecord falls back to SHIFT-001 when shiftId is null and no EmployeeShift found")
        void createManualRecord_FallbackShift_ToDefaultShift() {
            LocalDate date = LocalDate.of(2026, 10, 24);
            LocalDateTime inTime = date.atTime(8, 0);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(null)
                    .workDate(date)
                    .checkInTime(inTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(employeeShiftRepository.findByUserIdAndAssignedDate(1L, date)).thenReturn(Optional.empty());
            when(shiftRepository.findByShiftCode("SHIFT-001")).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("Ca hành chính", result.getShiftName());
        }

        @Test
        @DisplayName("createManualRecord with null checkOutTime succeeds and auto-infers ON_TIME when on time")
        void createManualRecord_Success_WithNullCheckOutTime_AutoInfersOnTime() {
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 5);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .workDate(LocalDate.of(2026, 10, 24))
                    .checkInTime(inTime)
                    .checkOutTime(null)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("ON_TIME", result.getStatus());
            assertEquals(inTime, result.getCheckInTime());
            assertNull(result.getCheckOutTime());
        }

        @Test
        @DisplayName("createManualRecord with null checkOutTime auto-infers LATE when check-in is after grace period")
        void createManualRecord_Success_WithNullCheckOutTime_AutoInfersLate() {
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 30);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .workDate(LocalDate.of(2026, 10, 24))
                    .checkInTime(inTime)
                    .checkOutTime(null)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("LATE", result.getStatus());
            assertNull(result.getCheckOutTime());
        }

        @Test
        @DisplayName("createManualRecord boundary test: check-in exactly at grace period end is ON_TIME")
        void createManualRecord_StatusInference_ExactGraceBoundary_OnTime() {
            // Shift starts at 08:00, grace is 15 minutes -> grace boundary is 08:15:00
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 15, 0);
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 17, 0, 0);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("ON_TIME", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord boundary test: check-in 1 second after grace period is LATE")
        void createManualRecord_StatusInference_ExactGraceBoundary_Late() {
            // Shift starts at 08:00, grace is 15 minutes -> 08:15:01 is LATE
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 15, 1);
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 17, 0, 0);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("LATE", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord boundary test: check-out exactly at shift end is ON_TIME")
        void createManualRecord_StatusInference_ExactShiftEndBoundary_OnTime() {
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 0, 0);
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 17, 0, 0);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("ON_TIME", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord boundary test: check-out 1 second before shift end is EARLY_LEAVE")
        void createManualRecord_StatusInference_ExactShiftEndBoundary_EarlyLeave() {
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 0, 0);
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 16, 59, 59);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("EARLY_LEAVE", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord defaults to 15m grace period when shift gracePeriodMinutes is null")
        void createManualRecord_StatusInference_DefaultGracePeriodWhenNull() {
            Shift shiftNoGrace = Shift.builder()
                    .id(30L)
                    .name("Ca không set grace")
                    .startTime(LocalTime.of(8, 0))
                    .endTime(LocalTime.of(17, 0))
                    .gracePeriodMinutes(null)
                    .build();

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(30L)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 15, 0)) // exactly 15m -> ON_TIME
                    .checkOutTime(LocalDateTime.of(2026, 10, 24, 17, 0, 0))
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(30L)).thenReturn(Optional.of(shiftNoGrace));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("ON_TIME", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord with both late check-in and early leave prioritizes LATE")
        void createManualRecord_BothLateAndEarlyLeave_PrioritizesLate() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 30)) // Late
                    .checkOutTime(LocalDateTime.of(2026, 10, 24, 16, 0)) // Early leave
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("LATE", result.getStatus());
        }

        @Test
        @DisplayName("createManualRecord updates correct shift when multiple records exist for user on same day")
        void createManualRecord_MultipleExistingRecords_UpdatesMatchingShiftOnly() {
            AttendanceRecord recShift10 = AttendanceRecord.builder().id(101L).user(user1).shift(standardShift).build();
            AttendanceRecord recShift20 = AttendanceRecord.builder().id(202L).user(user1).shift(overnightShift).build();

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(20L)
                    .workDate(LocalDate.of(2026, 10, 24))
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 22, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 25, 6, 0))
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(20L)).thenReturn(Optional.of(overnightShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(List.of(recShift10, recShift20));
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals(202L, result.getId(), "Should specifically update shift 20 record (id 202)");
            verify(attendanceRecordRepository).save(recShift20);
        }

        @Test
        @DisplayName("createManualRecord updates existing record with null shift when request has no shift")
        void createManualRecord_ExistingRecordWithNullShift_UpdatesWhenRequestShiftIsNull() {
            AttendanceRecord recNullShift = AttendanceRecord.builder().id(303L).user(user1).shift(null).build();

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(null)
                    .workDate(LocalDate.of(2026, 10, 24))
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 24, 17, 0))
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(employeeShiftRepository.findByUserIdAndAssignedDate(any(), any())).thenReturn(Optional.empty());
            when(shiftRepository.findByShiftCode("SHIFT-001")).thenReturn(Optional.empty());
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(List.of(recNullShift));
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals(303L, result.getId());
            verify(attendanceRecordRepository).save(recNullShift);
        }
    }

    // =========================================================================
    // 3. ST5-05: updateManualRecord
    // =========================================================================

    @Nested
    @DisplayName("ST5-05: updateManualRecord")
    class UpdateManualRecordTests {

        @Test
        @DisplayName("updateManualRecord with id > 0 updates existing attendance record")
        void updateManualRecord_WhenIdGreaterThanZero_UpdatesExistingRecord() {
            Long recordId = 100L;
            AttendanceRecord existing = AttendanceRecord.builder()
                    .id(recordId)
                    .user(user1)
                    .shift(standardShift)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 30))
                    .status("LATE")
                    .build();

            LocalDateTime newInTime = LocalDateTime.of(2026, 10, 24, 8, 0);
            LocalDateTime newOutTime = LocalDateTime.of(2026, 10, 24, 17, 0);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .shiftId(10L)
                    .checkInTime(newInTime)
                    .checkOutTime(newOutTime)
                    .status(null)
                    .build();

            when(attendanceRecordRepository.findById(recordId)).thenReturn(Optional.of(existing));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.updateManualRecord(recordId, dto);

            assertNotNull(result);
            assertEquals(recordId, result.getId());
            assertEquals("ON_TIME", result.getStatus());
            assertEquals(newInTime, existing.getCheckInTime());
            assertEquals(newOutTime, existing.getCheckOutTime());
            verify(attendanceRecordRepository).save(existing);
        }

        @Test
        @DisplayName("updateManualRecord with id > 0 throws ResourceNotFoundException when record not found")
        void updateManualRecord_WhenIdGreaterThanZero_ThrowsNotFound() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            when(attendanceRecordRepository.findById(999L)).thenReturn(Optional.empty());

            ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
                    () -> attendanceService.updateManualRecord(999L, dto));
            assertTrue(ex.getMessage().contains("999"));
        }

        @Test
        @DisplayName("updateManualRecord with id < 0 auto-looks up EmployeeShift and delegates to createManualRecord")
        void updateManualRecord_WhenIdLessThanZero_AutoLooksUpEmployeeShift() {
            Long negativeId = -42L;
            Long employeeShiftId = 42L;
            LocalDate assignedDate = LocalDate.of(2026, 10, 24);

            EmployeeShift es = new EmployeeShift();
            es.setId(employeeShiftId);
            es.setUser(user1);
            es.setShift(standardShift);
            es.setAssignedDate(assignedDate);

            LocalDateTime inTime = assignedDate.atTime(8, 0);
            LocalDateTime outTime = assignedDate.atTime(17, 0);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(employeeShiftRepository.findById(employeeShiftId)).thenReturn(Optional.of(es));
            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> {
                AttendanceRecord r = inv.getArgument(0);
                r.setId(888L);
                return r;
            });

            AttendanceHistoryDto result = attendanceService.updateManualRecord(negativeId, dto);

            assertNotNull(result);
            assertEquals(888L, result.getId());
            assertEquals("ON_TIME", result.getStatus());
            assertEquals("Ca hành chính", result.getShiftName());
            assertEquals("Nguyễn Văn A", result.getFullName());
            verify(employeeShiftRepository).findById(42L);
            verify(attendanceRecordRepository).save(any(AttendanceRecord.class));
        }

        @Test
        @DisplayName("updateManualRecord with id < 0 throws ResourceNotFoundException when EmployeeShift not found")
        void updateManualRecord_WhenIdLessThanZero_ThrowsNotFoundIfEmployeeShiftMissing() {
            Long negativeId = -999L;
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            when(employeeShiftRepository.findById(999L)).thenReturn(Optional.empty());

            ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
                    () -> attendanceService.updateManualRecord(negativeId, dto));
            assertTrue(ex.getMessage().contains("999"));
        }

        @Test
        @DisplayName("updateManualRecord throws BusinessException when id is null")
        void updateManualRecord_ThrowsBusinessException_WhenIdIsNull() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.updateManualRecord(null, dto));
            assertEquals("ID bản ghi chấm công không được để trống", ex.getMessage());
        }

        @Test
        @DisplayName("updateManualRecord throws BusinessException when dto is null")
        void updateManualRecord_ThrowsBusinessException_WhenDtoIsNull() {
            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.updateManualRecord(1L, null));
            assertEquals("Dữ liệu chấm công không được để trống", ex.getMessage());
        }

        @Test
        @DisplayName("updateManualRecord throws BusinessException when checkInTime is null")
        void updateManualRecord_ThrowsBusinessException_WhenCheckInIsNull() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .checkInTime(null)
                    .build();

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.updateManualRecord(1L, dto));
            assertEquals("Thời gian vào ca không được để trống", ex.getMessage());
        }

        @Test
        @DisplayName("updateManualRecord throws BusinessException when checkOutTime <= checkInTime")
        void updateManualRecord_ThrowsBusinessException_WhenCheckOutBeforeCheckIn() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 17, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.updateManualRecord(1L, dto));
            assertEquals("Thời gian ra ca phải sau thời gian vào ca", ex.getMessage());
        }

        @Test
        @DisplayName("updateManualRecord throws BusinessException when checkOutTime equals checkInTime")
        void updateManualRecord_ThrowsBusinessException_WhenCheckOutEqualsCheckIn() {
            LocalDateTime sameTime = LocalDateTime.of(2026, 10, 24, 8, 0);
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .checkInTime(sameTime)
                    .checkOutTime(sameTime)
                    .build();

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.updateManualRecord(1L, dto));
            assertEquals("Thời gian ra ca phải sau thời gian vào ca", ex.getMessage());
        }

        @Test
        @DisplayName("updateManualRecord with id > 0 updates shift to a different shift")
        void updateManualRecord_WhenIdGreaterThanZero_UpdatesShiftToDifferentShift() {
            Long recordId = 100L;
            AttendanceRecord existing = AttendanceRecord.builder()
                    .id(recordId)
                    .user(user1)
                    .shift(standardShift) // Currently Shift 10
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 22, 0))
                    .status("ON_TIME")
                    .build();

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .shiftId(20L) // Change to Shift 20 (overnightShift)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 22, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 25, 6, 0))
                    .build();

            when(attendanceRecordRepository.findById(recordId)).thenReturn(Optional.of(existing));
            when(shiftRepository.findById(20L)).thenReturn(Optional.of(overnightShift));
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.updateManualRecord(recordId, dto);

            assertNotNull(result);
            assertEquals("Ca đêm", result.getShiftName());
            assertEquals(20L, existing.getShift().getId());
            verify(attendanceRecordRepository).save(existing);
        }

        @Test
        @DisplayName("updateManualRecord with id > 0 falls back to EmployeeShift when record has null shift and dto shiftId is null")
        void updateManualRecord_WhenIdGreaterThanZero_FallsBackToEmployeeShiftWhenShiftNull() {
            Long recordId = 100L;
            AttendanceRecord existing = AttendanceRecord.builder()
                    .id(recordId)
                    .user(user1)
                    .shift(null)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .shiftId(null)
                    .workDate(LocalDate.of(2026, 10, 24))
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 24, 17, 0))
                    .build();

            EmployeeShift es = new EmployeeShift();
            es.setShift(standardShift);

            when(attendanceRecordRepository.findById(recordId)).thenReturn(Optional.of(existing));
            when(employeeShiftRepository.findByUserIdAndAssignedDate(1L, LocalDate.of(2026, 10, 24)))
                    .thenReturn(Optional.of(es));
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.updateManualRecord(recordId, dto);

            assertNotNull(result);
            assertEquals("Ca hành chính", result.getShiftName());
            assertEquals(standardShift, existing.getShift());
        }

        @Test
        @DisplayName("updateManualRecord with id < 0 throws BusinessException immediately when checkOut <= checkIn without querying repo")
        void updateManualRecord_WhenIdLessThanZero_CheckOutBeforeCheckIn_ThrowsBusinessExceptionImmediately() {
            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 17, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            BusinessException ex = assertThrows(BusinessException.class,
                    () -> attendanceService.updateManualRecord(-99L, dto));
            assertEquals("Thời gian ra ca phải sau thời gian vào ca", ex.getMessage());
            verify(employeeShiftRepository, never()).findById(any());
        }

        @Test
        @DisplayName("updateManualRecord with id < 0 preserves DTO userId and shiftId if provided by caller")
        void updateManualRecord_WhenIdLessThanZero_PreservesDtoUserIdAndShiftIdWhenProvided() {
            Long negativeId = -42L;
            LocalDate assignedDate = LocalDate.of(2026, 10, 24);

            EmployeeShift es = new EmployeeShift();
            es.setId(42L);
            es.setUser(user1); // EMP001 (id 1L)
            es.setShift(standardShift); // Shift 10L
            es.setAssignedDate(assignedDate);

            LocalDateTime inTime = assignedDate.atTime(8, 0);
            LocalDateTime outTime = assignedDate.atTime(17, 0);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(2L) // Explicitly override user to user2 (id 2L)
                    .shiftId(20L) // Explicitly override shift to overnightShift (id 20L)
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(employeeShiftRepository.findById(42L)).thenReturn(Optional.of(es));
            when(userRepository.findById(2L)).thenReturn(Optional.of(user2));
            when(shiftRepository.findById(20L)).thenReturn(Optional.of(overnightShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(2L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> {
                AttendanceRecord r = inv.getArgument(0);
                r.setId(999L);
                return r;
            });

            AttendanceHistoryDto result = attendanceService.updateManualRecord(negativeId, dto);

            assertNotNull(result);
            assertEquals("Trần Thị B", result.getFullName());
            assertEquals("Ca đêm", result.getShiftName());
        }

        @Test
        @DisplayName("updateManualRecord with id > 0 preserves explicit status in DTO")
        void updateManualRecord_WhenIdGreaterThanZero_PreservesExplicitStatus() {
            Long recordId = 100L;
            AttendanceRecord existing = AttendanceRecord.builder()
                    .id(recordId)
                    .user(user1)
                    .shift(standardShift)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 30))
                    .status("LATE")
                    .build();

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .shiftId(10L)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 30))
                    .checkOutTime(LocalDateTime.of(2026, 10, 24, 17, 0))
                    .status("EXCUSED")
                    .build();

            when(attendanceRecordRepository.findById(recordId)).thenReturn(Optional.of(existing));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.updateManualRecord(recordId, dto);

            assertNotNull(result);
            assertEquals("EXCUSED", result.getStatus());
        }

        @Test
        @DisplayName("updateManualRecord with id > 0 allows null checkOutTime")
        void updateManualRecord_WhenIdGreaterThanZero_AllowsNullCheckOutTime() {
            Long recordId = 100L;
            AttendanceRecord existing = AttendanceRecord.builder()
                    .id(recordId)
                    .user(user1)
                    .shift(standardShift)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 24, 17, 0))
                    .status("ON_TIME")
                    .build();

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .shiftId(10L)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 5))
                    .checkOutTime(null) // Clear check-out
                    .build();

            when(attendanceRecordRepository.findById(recordId)).thenReturn(Optional.of(existing));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            AttendanceHistoryDto result = attendanceService.updateManualRecord(recordId, dto);

            assertNotNull(result);
            assertNull(existing.getCheckOutTime());
            assertEquals("ON_TIME", result.getStatus());
        }
    }

    // =========================================================================
    // 4. AttendanceController Endpoints & Security Annotations
    // =========================================================================

    @Nested
    @DisplayName("AttendanceController Unit Tests")
    class AttendanceControllerTests {

        @Test
        @DisplayName("AttendanceController.getAllRecords uses search over keyword when search is provided")
        void controller_getAllRecords_PrefersSearchOverKeyword() {
            AttendanceService mockService = mock(AttendanceService.class);
            AttendanceController controller = new AttendanceController(mockService);

            when(mockService.getAllRecords(0, 10, null, null, null, null, "primarySearch"))
                    .thenReturn(PageResponse.from(Page.empty()));

            ResponseEntity<ApiResponse<PageResponse<AttendanceHistoryDto>>> res =
                    controller.getAllRecords(0, 10, null, null, null, null, "primarySearch", "fallbackKeyword");

            assertNotNull(res);
            assertEquals(HttpStatus.OK, res.getStatusCode());
            verify(mockService).getAllRecords(0, 10, null, null, null, null, "primarySearch");
        }

        @Test
        @DisplayName("AttendanceController.getAllRecords falls back to keyword when search is null/blank")
        void controller_getAllRecords_FallsBackToKeywordWhenSearchNull() {
            AttendanceService mockService = mock(AttendanceService.class);
            AttendanceController controller = new AttendanceController(mockService);

            when(mockService.getAllRecords(0, 10, null, null, null, null, "fallbackKeyword"))
                    .thenReturn(PageResponse.from(Page.empty()));

            ResponseEntity<ApiResponse<PageResponse<AttendanceHistoryDto>>> res =
                    controller.getAllRecords(0, 10, null, null, null, null, null, "fallbackKeyword");

            assertNotNull(res);
            assertEquals(HttpStatus.OK, res.getStatusCode());
            verify(mockService).getAllRecords(0, 10, null, null, null, null, "fallbackKeyword");
        }

        @Test
        @DisplayName("AttendanceController.createManualRecord delegates to service and returns 200 OK")
        void controller_createManualRecord_DelegatesToService() {
            AttendanceService mockService = mock(AttendanceService.class);
            AttendanceController controller = new AttendanceController(mockService);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            AttendanceHistoryDto expectedDto = AttendanceHistoryDto.builder().id(123L).build();
            when(mockService.createManualRecord(dto)).thenReturn(expectedDto);

            ResponseEntity<ApiResponse<AttendanceHistoryDto>> res = controller.createManualRecord(dto);

            assertNotNull(res);
            assertEquals(HttpStatus.OK, res.getStatusCode());
            assertNotNull(res.getBody());
            assertEquals("SUCCESS", res.getBody().getStatus());
            assertEquals(123L, res.getBody().getData().getId());
            verify(mockService).createManualRecord(dto);
        }

        @Test
        @DisplayName("AttendanceController.createManualRecord has PreAuthorize with ROLE_ADMIN")
        void controller_createManualRecord_HasAdminSecurityAnnotation() throws NoSuchMethodException {
            Method method = AttendanceController.class.getMethod("createManualRecord", ManualAttendanceRequestDto.class);
            PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
            assertNotNull(preAuthorize);
            assertEquals("hasRole('ROLE_ADMIN')", preAuthorize.value());
        }

        @Test
        @DisplayName("AttendanceController.updateManualRecord delegates to service and returns 200 OK")
        void controller_updateManualRecord_DelegatesToService() {
            AttendanceService mockService = mock(AttendanceService.class);
            AttendanceController controller = new AttendanceController(mockService);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                    .build();

            AttendanceHistoryDto expectedDto = AttendanceHistoryDto.builder().id(456L).build();
            when(mockService.updateManualRecord(456L, dto)).thenReturn(expectedDto);

            ResponseEntity<ApiResponse<AttendanceHistoryDto>> res = controller.updateManualRecord(456L, dto);

            assertNotNull(res);
            assertEquals(HttpStatus.OK, res.getStatusCode());
            assertNotNull(res.getBody());
            assertEquals("SUCCESS", res.getBody().getStatus());
            assertEquals(456L, res.getBody().getData().getId());
            verify(mockService).updateManualRecord(456L, dto);
        }

        @Test
        @DisplayName("AttendanceController.updateManualRecord has PreAuthorize with ROLE_ADMIN")
        void controller_updateManualRecord_HasAdminSecurityAnnotation() throws NoSuchMethodException {
            Method method = AttendanceController.class.getMethod("updateManualRecord", Long.class, ManualAttendanceRequestDto.class);
            PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
            assertNotNull(preAuthorize);
            assertEquals("hasRole('ROLE_ADMIN')", preAuthorize.value());
        }

        @Test
        @DisplayName("AttendanceController.getAllRecords passes null to service when search and keyword are blank")
        void controller_getAllRecords_BlankSearchAndKeyword_PassesNullToService() {
            AttendanceService mockService = mock(AttendanceService.class);
            AttendanceController controller = new AttendanceController(mockService);

            when(mockService.getAllRecords(0, 10, null, null, null, null, null))
                    .thenReturn(PageResponse.from(Page.empty()));

            ResponseEntity<ApiResponse<PageResponse<AttendanceHistoryDto>>> res =
                    controller.getAllRecords(0, 10, null, null, null, null, "   ", "   ");

            assertNotNull(res);
            assertEquals(HttpStatus.OK, res.getStatusCode());
            verify(mockService).getAllRecords(0, 10, null, null, null, null, null);
        }
    }

    // =========================================================================
    // 5. Presigned URL Mapping Tests
    // =========================================================================

    @Nested
    @DisplayName("Presigned URL Mapping Tests")
    class PresignedUrlMappingTests {

        @Test
        @DisplayName("createManualRecord maps presigned URLs for both check-in and check-out snapshots with 15m duration")
        void createManualRecord_MapsPresignedUrls_ForBothSnapshots() {
            LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 0);
            LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 17, 0);

            ManualAttendanceRequestDto dto = ManualAttendanceRequestDto.builder()
                    .userId(1L)
                    .shiftId(10L)
                    .checkInTime(inTime)
                    .checkOutTime(outTime)
                    .build();

            when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
            when(shiftRepository.findById(10L)).thenReturn(Optional.of(standardShift));
            when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                    .thenReturn(Collections.emptyList());
            when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> {
                AttendanceRecord r = inv.getArgument(0);
                r.setId(789L);
                r.setSnapshotUrl("snapshots/checkin.jpg");
                r.setCheckoutSnapshotUrl("snapshots/checkout.jpg");
                return r;
            });
            when(storageService.getPresignedUrl("snapshots/checkin.jpg", 15)).thenReturn("http://minio/signed-checkin.jpg");
            when(storageService.getPresignedUrl("snapshots/checkout.jpg", 15)).thenReturn("http://minio/signed-checkout.jpg");

            AttendanceHistoryDto result = attendanceService.createManualRecord(dto);

            assertNotNull(result);
            assertEquals("http://minio/signed-checkin.jpg", result.getSnapshotUrl());
            assertEquals("http://minio/signed-checkout.jpg", result.getCheckoutSnapshotUrl());
            verify(storageService).getPresignedUrl("snapshots/checkin.jpg", 15);
            verify(storageService).getPresignedUrl("snapshots/checkout.jpg", 15);
        }
    }
}
