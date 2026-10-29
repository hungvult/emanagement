package com.emanagement.backend.modules.attendance;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

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

@ExtendWith(MockitoExtension.class)
class AttendanceExportTest {

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
    private jakarta.persistence.EntityManager entityManager;

    @Mock
    private com.emanagement.backend.modules.notification.NotificationService notificationService;

    @InjectMocks
    private AttendanceServiceImpl attendanceService;

    private User sampleUser;
    private Shift sampleShift;
    private Kiosk sampleKiosk;

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .id(1L)
                .employeeCode("EMP260001")
                .fullName("Ngô Văn Dũng")
                .build();

        sampleShift = Shift.builder()
                .id(10L)
                .shiftCode("SHIFT-001")
                .name("Ca hành chính")
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(17, 0))
                .build();

        sampleKiosk = new Kiosk();
        sampleKiosk.setId(100L);
        sampleKiosk.setName("Trạm Kiosk Trụ Sở Chính");
    }

    // =========================================================================
    // 1. Header & UTF-8 BOM Verification
    // =========================================================================

    @Test
    @DisplayName("exportAttendanceToCsv writes UTF-8 BOM (0xEF, 0xBB, 0xBF) and correct header")
    void exportAttendanceToCsv_Success_HeaderAndBomPresence() throws IOException {
        when(attendanceRecordRepository.findAllWithExportFilters(
                anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                anyBoolean(), any(), anyBoolean(), anyString(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 23), null, null, null);

        byte[] bytes = baos.toByteArray();
        assertTrue(bytes.length >= 3, "Output should contain at least 3 BOM bytes");
        assertEquals((byte) 0xEF, bytes[0]);
        assertEquals((byte) 0xBB, bytes[1]);
        assertEquals((byte) 0xBF, bytes[2]);

        String csvContent = new String(bytes, StandardCharsets.UTF_8);
        assertTrue(csvContent.startsWith("\uFEFFSTT,Mã nhân viên,Họ và tên,Ngày làm việc,Ca làm việc,Giờ vào,Giờ ra,Số giờ làm,Trạng thái,Trạm Kiosk\r\n"));
    }

    // =========================================================================
    // 2. Data Row Formatting & Status Translations
    // =========================================================================

    @Test
    @DisplayName("exportAttendanceToCsv formats data rows and translates Vietnamese statuses properly")
    void exportAttendanceToCsv_Success_DataRowFormattingAndStatusTranslations() throws IOException {
        LocalDateTime checkIn1 = LocalDateTime.of(2026, 10, 23, 7, 55, 12);
        LocalDateTime checkOut1 = LocalDateTime.of(2026, 10, 23, 17, 5, 40);

        AttendanceRecord record1 = AttendanceRecord.builder()
                .id(1L)
                .user(sampleUser)
                .shift(sampleShift)
                .kiosk(sampleKiosk)
                .checkInTime(checkIn1)
                .checkOutTime(checkOut1)
                .status("ON_TIME")
                .build();

        User user2 = User.builder().id(2L).employeeCode("EMP260002").fullName("Trần Thị Hoa").build();
        AttendanceRecord record2 = AttendanceRecord.builder()
                .id(2L)
                .user(user2)
                .shift(sampleShift)
                .kiosk(sampleKiosk)
                .checkInTime(LocalDateTime.of(2026, 10, 23, 8, 30, 0))
                .checkOutTime(LocalDateTime.of(2026, 10, 23, 17, 30, 0))
                .status("LATE")
                .build();

        User user3 = User.builder().id(3L).employeeCode("EMP260003").fullName("Lê Văn Cường").build();
        AttendanceRecord record3 = AttendanceRecord.builder()
                .id(3L)
                .user(user3)
                .shift(sampleShift)
                .kiosk(sampleKiosk)
                .checkInTime(LocalDateTime.of(2026, 10, 23, 8, 0, 0))
                .checkOutTime(LocalDateTime.of(2026, 10, 23, 15, 0, 0))
                .status("EARLY_LEAVE")
                .build();

        User user4 = User.builder().id(4L).employeeCode("EMP260004").fullName("Phạm Minh Đức").build();
        AttendanceRecord record4 = AttendanceRecord.builder()
                .id(4L)
                .user(user4)
                .shift(sampleShift)
                .kiosk(sampleKiosk)
                .checkInTime(LocalDateTime.of(2026, 10, 23, 7, 50, 0))
                .checkOutTime(null) // Chưa check-out
                .status("ON_TIME")
                .build();

        User user5 = User.builder().id(5L).employeeCode("EMP260005").fullName("Vũ Hoàng Nam").build();
        AttendanceRecord record5 = AttendanceRecord.builder()
                .id(5L)
                .user(user5)
                .shift(sampleShift)
                .kiosk(null) // Không có Kiosk
                .checkInTime(null)
                .checkOutTime(null)
                .createdAt(LocalDateTime.of(2026, 10, 23, 8, 0, 0))
                .status("NO_DATA")
                .build();

        List<AttendanceRecord> records = List.of(record1, record2, record3, record4, record5);
        when(attendanceRecordRepository.findAllWithExportFilters(
                anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                anyBoolean(), any(), anyBoolean(), anyString(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(records));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 23), null, null, null);

        String csv = new String(baos.toByteArray(), StandardCharsets.UTF_8);
        String[] lines = csv.split("\r\n");

        assertEquals(6, lines.length, "Header + 5 data lines expected");

        // Row 1: ON_TIME -> "Đúng giờ", work hours = 9.17
        assertEquals("1,EMP260001,\"Ngô Văn Dũng\",2026-10-23,\"Ca hành chính\",07:55:12,17:05:40,9.17,\"Đúng giờ\",\"Trạm Kiosk Trụ Sở Chính\"", lines[1]);

        // Row 2: LATE -> "Đi muộn", work hours = 9.00
        assertEquals("2,EMP260002,\"Trần Thị Hoa\",2026-10-23,\"Ca hành chính\",08:30:00,17:30:00,9.00,\"Đi muộn\",\"Trạm Kiosk Trụ Sở Chính\"", lines[2]);

        // Row 3: EARLY_LEAVE -> "Về sớm", work hours = 7.00
        assertEquals("3,EMP260003,\"Lê Văn Cường\",2026-10-23,\"Ca hành chính\",08:00:00,15:00:00,7.00,\"Về sớm\",\"Trạm Kiosk Trụ Sở Chính\"", lines[3]);

        // Row 4: No checkout -> work hours empty (col 7 & 8 empty)
        assertEquals("4,EMP260004,\"Phạm Minh Đức\",2026-10-23,\"Ca hành chính\",07:50:00,,,\"Đúng giờ\",\"Trạm Kiosk Trụ Sở Chính\"", lines[4]);

        // Row 5: NO_DATA -> "Chưa chấm công", work hours empty, fallback kiosk "—" (col 6, 7 & 8 empty)
        assertEquals("5,EMP260005,\"Vũ Hoàng Nam\",2026-10-23,\"Ca hành chính\",,,,\"Chưa chấm công\",\"—\"", lines[5]);
    }

    // =========================================================================
    // 3. Escaping Special Characters (RFC 4180)
    // =========================================================================

    @Test
    @DisplayName("exportAttendanceToCsv escapes quotes and commas per RFC 4180")
    void exportAttendanceToCsv_Success_EscapingSpecialCharacters() throws IOException {
        User userSpecial = User.builder()
                .id(10L)
                .employeeCode("EMP,\"TEST\"")
                .fullName("Nguyễn \"Bảo\" Nam, Kỹ Sư")
                .build();

        Shift shiftSpecial = Shift.builder()
                .id(20L)
                .name("Ca \"Đặc Biệt\", VIP")
                .build();

        Kiosk kioskSpecial = new Kiosk();
        kioskSpecial.setName("Trạm Kiosk \"Cổng 1\", Tòa Nhà Bitexco");

        AttendanceRecord record = AttendanceRecord.builder()
                .id(100L)
                .user(userSpecial)
                .shift(shiftSpecial)
                .kiosk(kioskSpecial)
                .checkInTime(LocalDateTime.of(2026, 10, 23, 8, 0, 0))
                .checkOutTime(LocalDateTime.of(2026, 10, 23, 17, 0, 0))
                .status("ON_TIME")
                .build();

        when(attendanceRecordRepository.findAllWithExportFilters(
                anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                anyBoolean(), any(), anyBoolean(), anyString(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(record)));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 23), null, null, null);

        String csv = new String(baos.toByteArray(), StandardCharsets.UTF_8);
        String[] lines = csv.split("\r\n");

        assertEquals(2, lines.length);

        // EmployeeCode has comma and quotes -> escaped as "EMP,""TEST"""
        // FullName has quotes and comma -> escaped as "Nguyễn ""Bảo"" Nam, Kỹ Sư"
        // Shift has quotes and comma -> escaped as "Ca ""Đặc Biệt"", VIP"
        // Kiosk has quotes and comma -> escaped as "Trạm Kiosk ""Cổng 1"", Tòa Nhà Bitexco"
        assertEquals("1,\"EMP,\"\"TEST\"\"\",\"Nguyễn \"\"Bảo\"\" Nam, Kỹ Sư\",2026-10-23,\"Ca \"\"Đặc Biệt\"\", VIP\",08:00:00,17:00:00,9.00,\"Đúng giờ\",\"Trạm Kiosk \"\"Cổng 1\"\", Tòa Nhà Bitexco\"", lines[1]);
    }

    // =========================================================================
    // 4. Filters Applied (startDate, endDate, status, shiftId, search)
    // =========================================================================

    @Test
    @DisplayName("exportAttendanceToCsv passes all filter arguments to repository query")
    void exportAttendanceToCsv_Success_FiltersApplied() throws IOException {
        LocalDate start = LocalDate.of(2026, 10, 5);
        LocalDate end = LocalDate.of(2026, 10, 20);
        String status = "LATE";
        Long shiftId = 15L;
        String search = "EMP260001";

        when(attendanceRecordRepository.findAllWithExportFilters(
                eq(true), eq(start.atStartOfDay()),
                eq(true), eq(end.plusDays(1).atStartOfDay()),
                eq(true), eq("LATE"),
                eq(true), eq(15L),
                eq(true), eq("EMP260001"),
                any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, start, end, status, shiftId, search);

        verify(attendanceRecordRepository).findAllWithExportFilters(
                eq(true), eq(start.atStartOfDay()),
                eq(true), eq(end.plusDays(1).atStartOfDay()),
                eq(true), eq("LATE"),
                eq(true), eq(15L),
                eq(true), eq("EMP260001"),
                any(Pageable.class));
    }

    @Test
    @DisplayName("exportAttendanceToCsv defaults startDate to 1st of month and endDate to today when null")
    void exportAttendanceToCsv_Success_DefaultDateFilters() throws IOException {
        LocalDate expectedStart = LocalDate.now().withDayOfMonth(1);
        LocalDate expectedEnd = LocalDate.now();

        when(attendanceRecordRepository.findAllWithExportFilters(
                eq(true), eq(expectedStart.atStartOfDay()),
                eq(true), eq(expectedEnd.plusDays(1).atStartOfDay()),
                eq(false), eq(""),
                eq(false), isNull(),
                eq(false), eq(""),
                any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, null, null, null, null, null);

        verify(attendanceRecordRepository).findAllWithExportFilters(
                eq(true), eq(expectedStart.atStartOfDay()),
                eq(true), eq(expectedEnd.plusDays(1).atStartOfDay()),
                eq(false), eq(""),
                eq(false), isNull(),
                eq(false), eq(""),
                any(Pageable.class));
    }

    // =========================================================================
    // 5. NO_DATA Filter with Unattended Shifts
    // =========================================================================

    @Test
    @DisplayName("exportAttendanceToCsv handles status=NO_DATA by querying unattended shifts from employee_shifts")
    void exportAttendanceToCsv_Success_NoDataFilterWithUnattendedShifts() throws IOException {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 5);

        when(attendanceRecordRepository.findAllWithExportFilters(
                anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                anyBoolean(), any(), anyBoolean(), anyString(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        EmployeeShift es = new EmployeeShift();
        es.setId(101L);
        es.setUser(sampleUser);
        es.setShift(sampleShift);
        es.setShiftName("Ca hành chính");
        es.setAssignedDate(LocalDate.of(2026, 10, 3));

        when(employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                .thenReturn(List.of(es));
        when(attendanceRecordRepository.findByUserIdInAndCheckInTimeBetween(any(), any(), any()))
                .thenReturn(Collections.emptyList());

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, start, end, "NO_DATA", null, "Ngô Văn");

        String csv = new String(baos.toByteArray(), StandardCharsets.UTF_8);
        String[] lines = csv.split("\r\n");

        assertEquals(2, lines.length);
        assertEquals("1,EMP260001,\"Ngô Văn Dũng\",2026-10-03,\"Ca hành chính\",,,,\"Chưa chấm công\",\"—\"", lines[1]);
    }

    // =========================================================================
    // 6. Pagination / Chunking (O(1) RAM Verification)
    // =========================================================================

    @Test
    @DisplayName("exportAttendanceToCsv processes multiple batches chunked by 500 records")
    void exportAttendanceToCsv_Success_PaginationChunking() throws IOException {
        List<AttendanceRecord> batch1 = new ArrayList<>();
        for (int i = 1; i <= 500; i++) {
            User u = User.builder().id((long) i).employeeCode("EMP" + i).fullName("Nhân viên " + i).build();
            batch1.add(AttendanceRecord.builder()
                    .id((long) i)
                    .user(u)
                    .shift(sampleShift)
                    .kiosk(sampleKiosk)
                    .checkInTime(LocalDateTime.of(2026, 10, 23, 8, 0, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 23, 17, 0, 0))
                    .status("ON_TIME")
                    .build());
        }

        List<AttendanceRecord> batch2 = new ArrayList<>();
        for (int i = 501; i <= 550; i++) {
            User u = User.builder().id((long) i).employeeCode("EMP" + i).fullName("Nhân viên " + i).build();
            batch2.add(AttendanceRecord.builder()
                    .id((long) i)
                    .user(u)
                    .shift(sampleShift)
                    .kiosk(sampleKiosk)
                    .checkInTime(LocalDateTime.of(2026, 10, 23, 8, 0, 0))
                    .checkOutTime(LocalDateTime.of(2026, 10, 23, 17, 0, 0))
                    .status("ON_TIME")
                    .build());
        }

        Page<AttendanceRecord> page0 = new PageImpl<>(batch1, PageRequest.of(0, 500), 550);
        Page<AttendanceRecord> page1 = new PageImpl<>(batch2, PageRequest.of(1, 500), 550);

        when(attendanceRecordRepository.findAllWithExportFilters(
                anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                anyBoolean(), any(), anyBoolean(), anyString(), eq(PageRequest.of(0, 500))))
                .thenReturn(page0);

        when(attendanceRecordRepository.findAllWithExportFilters(
                anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                anyBoolean(), any(), anyBoolean(), anyString(), eq(PageRequest.of(1, 500))))
                .thenReturn(page1);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 23), null, null, null);

        String csv = new String(baos.toByteArray(), StandardCharsets.UTF_8);
        String[] lines = csv.split("\r\n");

        // 1 header + 550 records
        assertEquals(551, lines.length);

        // Verify sequence numbers
        assertTrue(lines[1].startsWith("1,EMP1,\"Nhân viên 1\""));
        assertTrue(lines[500].startsWith("500,EMP500,\"Nhân viên 500\""));
        assertTrue(lines[501].startsWith("501,EMP501,\"Nhân viên 501\""));
        assertTrue(lines[550].startsWith("550,EMP550,\"Nhân viên 550\""));

        // Verify EntityManager.clear was called on each batch to prevent first-level cache accumulation
        verify(entityManager, times(2)).clear();
    }

    // =========================================================================
    // 7. Edge Case: StartDate after EndDate
    // =========================================================================

    @Test
    @DisplayName("exportAttendanceToCsv writes only BOM and header when startDate is after endDate")
    void exportAttendanceToCsv_WhenStartDateAfterEndDate_WritesHeaderOnly() throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, LocalDate.of(2026, 10, 25), LocalDate.of(2026, 10, 20), null, null, null);

        verify(attendanceRecordRepository, never()).findAllWithExportFilters(
                anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                anyBoolean(), any(), anyBoolean(), anyString(), any(Pageable.class));

        String csv = new String(baos.toByteArray(), StandardCharsets.UTF_8);
        String[] lines = csv.split("\r\n");
        assertEquals(1, lines.length, "Only header should be written");
    }

    // =========================================================================
    // 8. Controller Endpoint Verification
    // =========================================================================

    @Test
    @DisplayName("AttendanceController.exportAttendance returns StreamingResponseBody and required headers")
    void controller_exportAttendance_ReturnsStreamingResponseBodyAndCorrectHeaders() throws IOException {
        AttendanceService mockService = mock(AttendanceService.class);
        AttendanceController controller = new AttendanceController(mockService);

        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 23);

        ResponseEntity<StreamingResponseBody> response = controller.exportAttendance(start, end, "ON_TIME", 10L, "EMP001");

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("text/csv;charset=UTF-8", response.getHeaders().getContentType().toString());

        String contentDisp = response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION);
        assertNotNull(contentDisp);
        assertTrue(contentDisp.matches("attachment; filename=\"bang_cham_cong_\\d{8}_\\d{6}\\.csv\""),
                "Filename should match pattern bang_cham_cong_yyyyMMdd_HHmmss.csv");

        StreamingResponseBody body = response.getBody();
        assertNotNull(body);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        body.writeTo(baos);

        verify(mockService).exportAttendanceToCsv(any(), eq(start), eq(end), eq("ON_TIME"), eq(10L), eq("EMP001"));
    }

    @Test
    @DisplayName("AttendanceController.exportAttendance has PreAuthorize with ROLE_ADMIN and ROLE_MANAGER")
    void controller_exportAttendance_PreAuthorizeAnnotation() throws NoSuchMethodException {
        Method method = AttendanceController.class.getMethod("exportAttendance",
                LocalDate.class, LocalDate.class, String.class, Long.class, String.class);

        PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
        assertNotNull(preAuthorize, "@PreAuthorize must be present on exportAttendance");
        assertEquals("hasAnyRole('ROLE_ADMIN', 'ROLE_MANAGER')", preAuthorize.value());
    }

    // =========================================================================
    // 9. Additional Edge Case Tests
    // =========================================================================

    @Test
    @DisplayName("exportAttendanceToCsv normalizes lowercase status parameter to uppercase")
    void exportAttendanceToCsv_Success_NormalizesLowercaseStatus() throws IOException {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 23);

        when(attendanceRecordRepository.findAllWithExportFilters(
                eq(true), eq(start.atStartOfDay()),
                eq(true), eq(end.plusDays(1).atStartOfDay()),
                eq(true), eq("LATE"),
                eq(false), isNull(),
                eq(false), eq(""),
                any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.emptyList()));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, start, end, "late", null, null);

        verify(attendanceRecordRepository).findAllWithExportFilters(
                eq(true), eq(start.atStartOfDay()),
                eq(true), eq(end.plusDays(1).atStartOfDay()),
                eq(true), eq("LATE"),
                eq(false), isNull(),
                eq(false), eq(""),
                any(Pageable.class));
    }

    @Test
    @DisplayName("exportAttendanceToCsv includes unattended shifts when status is null (All Records)")
    void exportAttendanceToCsv_Success_IncludesUnattendedShiftsWhenStatusIsNull() throws IOException {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 5);

        // 1 attended record
        AttendanceRecord attended = AttendanceRecord.builder()
                .id(1L)
                .user(sampleUser)
                .shift(sampleShift)
                .kiosk(sampleKiosk)
                .checkInTime(LocalDateTime.of(2026, 10, 1, 8, 0, 0))
                .checkOutTime(LocalDateTime.of(2026, 10, 1, 17, 0, 0))
                .status("ON_TIME")
                .build();

        when(attendanceRecordRepository.findAllWithExportFilters(
                anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                anyBoolean(), any(), anyBoolean(), anyString(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(attended)));

        // 1 unattended shift on 2026-10-02
        User absentUser = User.builder().id(2L).employeeCode("EMP260002").fullName("Trần Thị Hoa").build();
        EmployeeShift es = new EmployeeShift();
        es.setId(201L);
        es.setUser(absentUser);
        es.setShift(sampleShift);
        es.setShiftName("Ca hành chính");
        es.setAssignedDate(LocalDate.of(2026, 10, 2));

        when(employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                .thenReturn(List.of(es));
        when(attendanceRecordRepository.findByUserIdInAndCheckInTimeBetween(any(), any(), any()))
                .thenReturn(Collections.emptyList());

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, start, end, null, null, null);

        String csv = new String(baos.toByteArray(), StandardCharsets.UTF_8);
        String[] lines = csv.split("\r\n");

        // 1 header + 1 attended row + 1 unattended row
        assertEquals(3, lines.length);
        assertEquals("1,EMP260001,\"Ngô Văn Dũng\",2026-10-01,\"Ca hành chính\",08:00:00,17:00:00,9.00,\"Đúng giờ\",\"Trạm Kiosk Trụ Sở Chính\"", lines[1]);
        assertEquals("2,EMP260002,\"Trần Thị Hoa\",2026-10-02,\"Ca hành chính\",,,,\"Chưa chấm công\",\"—\"", lines[2]);
    }

    @Test
    @DisplayName("exportAttendanceToCsv resolves fallback shift name when record shift is null")
    void exportAttendanceToCsv_Success_FallbackShiftResolutionWhenRecordShiftIsNull() throws IOException {
        LocalDate date = LocalDate.of(2026, 10, 23);
        AttendanceRecord recordWithoutShift = AttendanceRecord.builder()
                .id(50L)
                .user(sampleUser)
                .shift(null)
                .kiosk(sampleKiosk)
                .checkInTime(LocalDateTime.of(2026, 10, 23, 8, 0, 0))
                .checkOutTime(LocalDateTime.of(2026, 10, 23, 17, 0, 0))
                .status("ON_TIME")
                .build();

        when(attendanceRecordRepository.findAllWithExportFilters(
                anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                anyBoolean(), any(), anyBoolean(), anyString(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(recordWithoutShift)));

        when(shiftRepository.findByShiftCode("SHIFT-001")).thenReturn(Optional.of(sampleShift));
        when(employeeShiftRepository.findByUserIdAndAssignedDate(eq(1L), eq(date))).thenReturn(Optional.empty());

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, date, date, "ON_TIME", null, null);

        String csv = new String(baos.toByteArray(), StandardCharsets.UTF_8);
        String[] lines = csv.split("\r\n");

        assertEquals(2, lines.length);
        assertTrue(lines[1].contains("\"Ca hành chính\""), "Should resolve fallback shift SHIFT-001 name");
    }

    @Test
    @DisplayName("exportAttendanceToCsv outputs 0.00 work hours when checkOut is before checkIn")
    void exportAttendanceToCsv_Success_NegativeWorkHoursDefaultsToZero() throws IOException {
        AttendanceRecord badRecord = AttendanceRecord.builder()
                .id(99L)
                .user(sampleUser)
                .shift(sampleShift)
                .kiosk(sampleKiosk)
                .checkInTime(LocalDateTime.of(2026, 10, 23, 17, 0, 0))
                .checkOutTime(LocalDateTime.of(2026, 10, 23, 8, 0, 0)) // CheckOut before CheckIn
                .status("ON_TIME")
                .build();

        when(attendanceRecordRepository.findAllWithExportFilters(
                anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(),
                anyBoolean(), any(), anyBoolean(), anyString(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(badRecord)));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        attendanceService.exportAttendanceToCsv(baos, LocalDate.of(2026, 10, 23), LocalDate.of(2026, 10, 23), "ON_TIME", null, null);

        String csv = new String(baos.toByteArray(), StandardCharsets.UTF_8);
        String[] lines = csv.split("\r\n");

        assertEquals(2, lines.length);
        assertEquals("1,EMP260001,\"Ngô Văn Dũng\",2026-10-23,\"Ca hành chính\",17:00:00,08:00:00,0.00,\"Đúng giờ\",\"Trạm Kiosk Trụ Sở Chính\"", lines[1]);
    }

    // =========================================================================
    // 10. Subtask 3.1 Unit Tests (ST5-04 & ST5-05)
    // =========================================================================

    @Test
    @DisplayName("ST5-04: getAllRecords with search filters both attended records and unattended NO_DATA shifts by employee code")
    void getAllRecords_WithSearch_FiltersAttendedAndUnattendedByEmployeeCode() {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 24);
        String searchCode = "EMP260001";

        // 1 attended record for sampleUser (EMP260001)
        AttendanceRecord attendedRecord = AttendanceRecord.builder()
                .id(101L)
                .user(sampleUser)
                .shift(sampleShift)
                .kiosk(sampleKiosk)
                .checkInTime(LocalDateTime.of(2026, 10, 24, 7, 55))
                .checkOutTime(LocalDateTime.of(2026, 10, 24, 17, 5))
                .status("ON_TIME")
                .build();

        when(attendanceRecordRepository.findAllWithExportFilters(
                eq(true), eq(start.atStartOfDay()),
                eq(true), eq(end.plusDays(1).atStartOfDay()),
                eq(false), eq(""),
                eq(false), isNull(),
                eq(true), eq(searchCode),
                eq(PageRequest.of(0, 1000))))
                .thenReturn(new PageImpl<>(List.of(attendedRecord)));

        // 2 scheduled unattended shifts: 1 for sampleUser (EMP260001), 1 for other user (EMP260002)
        User otherUser = User.builder().id(2L).employeeCode("EMP260002").fullName("Trần Thị B").build();

        EmployeeShift es1 = new EmployeeShift();
        es1.setId(501L);
        es1.setUser(sampleUser);
        es1.setShift(sampleShift);
        es1.setShiftName("Ca hành chính");
        es1.setAssignedDate(LocalDate.of(2026, 10, 22));

        EmployeeShift es2 = new EmployeeShift();
        es2.setId(502L);
        es2.setUser(otherUser);
        es2.setShift(sampleShift);
        es2.setShiftName("Ca hành chính");
        es2.setAssignedDate(LocalDate.of(2026, 10, 22));

        when(employeeShiftRepository.findByAssignedDateBetweenOrderByAssignedDateAsc(any(), any()))
                .thenReturn(List.of(es1, es2));
        when(attendanceRecordRepository.findByUserIdInAndCheckInTimeBetween(any(), any(), any()))
                .thenReturn(Collections.emptyList());

        PageResponse<AttendanceHistoryDto> result = attendanceService.getAllRecords(0, 10, start, end, null, null, searchCode);

        assertNotNull(result);
        assertEquals(2, result.getContent().size());
        assertTrue(result.getContent().stream().allMatch(r -> searchCode.equals(r.getEmployeeCode())),
                "All returned records must match search employee code EMP260001");
        assertTrue(result.getContent().stream().anyMatch(r -> r.getId().equals(101L)), "Must include attended record");
        assertTrue(result.getContent().stream().anyMatch(r -> r.getId().equals(-501L)), "Must include unattended shift (-501)");
    }

    @Test
    @DisplayName("ST5-05: createManualRecord creates record, auto-infers status, updates existing same shift and does not overwrite other shift")
    void createManualRecord_Success_AutoInfersStatusAndUpdatesSameShiftRecord() {
        LocalDate workDate = LocalDate.of(2026, 10, 24);
        LocalDateTime inTimeOnTime = LocalDateTime.of(2026, 10, 24, 8, 10);
        LocalDateTime outTimeOnTime = LocalDateTime.of(2026, 10, 24, 17, 10);

        // 1. Create new record with auto-inferred ON_TIME status
        ManualAttendanceRequestDto dtoNew = ManualAttendanceRequestDto.builder()
                .userId(1L)
                .shiftId(10L)
                .workDate(workDate)
                .checkInTime(inTimeOnTime)
                .checkOutTime(outTimeOnTime)
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(shiftRepository.findById(10L)).thenReturn(Optional.of(sampleShift));
        when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                .thenReturn(Collections.emptyList());
        when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> {
            AttendanceRecord r = inv.getArgument(0);
            r.setId(301L);
            return r;
        });

        AttendanceHistoryDto resultOnTime = attendanceService.createManualRecord(dtoNew);
        assertEquals("ON_TIME", resultOnTime.getStatus());
        assertEquals(301L, resultOnTime.getId());

        // 2. Auto-infer LATE when check-in is after grace period
        ManualAttendanceRequestDto dtoLate = ManualAttendanceRequestDto.builder()
                .userId(1L)
                .shiftId(10L)
                .workDate(workDate)
                .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 25))
                .checkOutTime(outTimeOnTime)
                .build();

        AttendanceHistoryDto resultLate = attendanceService.createManualRecord(dtoLate);
        assertEquals("LATE", resultLate.getStatus());

        // 3. Auto-infer EARLY_LEAVE when checkout is before shift end
        ManualAttendanceRequestDto dtoEarly = ManualAttendanceRequestDto.builder()
                .userId(1L)
                .shiftId(10L)
                .workDate(workDate)
                .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 0))
                .checkOutTime(LocalDateTime.of(2026, 10, 24, 16, 30))
                .build();

        AttendanceHistoryDto resultEarly = attendanceService.createManualRecord(dtoEarly);
        assertEquals("EARLY_LEAVE", resultEarly.getStatus());

        // 4. Updates existing record of SAME shift on that day
        AttendanceRecord existingShift10 = AttendanceRecord.builder()
                .id(777L)
                .user(sampleUser)
                .shift(sampleShift)
                .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 30))
                .status("LATE")
                .build();

        when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                .thenReturn(List.of(existingShift10));
        when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        AttendanceHistoryDto resultUpdated = attendanceService.createManualRecord(dtoNew);
        assertEquals(777L, resultUpdated.getId(), "Must update existing record with ID 777");
        assertEquals("ON_TIME", resultUpdated.getStatus());

        // 5. Does NOT overwrite record of DIFFERENT shift on same day
        Shift shiftOther = Shift.builder().id(20L).shiftCode("SHIFT-NIGHT").name("Ca đêm").startTime(LocalTime.of(22, 0)).endTime(LocalTime.of(6, 0)).build();
        ManualAttendanceRequestDto dtoOtherShift = ManualAttendanceRequestDto.builder()
                .userId(1L)
                .shiftId(20L)
                .workDate(workDate)
                .checkInTime(LocalDateTime.of(2026, 10, 24, 22, 0))
                .checkOutTime(LocalDateTime.of(2026, 10, 25, 6, 0))
                .build();

        when(shiftRepository.findById(20L)).thenReturn(Optional.of(shiftOther));
        when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                .thenReturn(List.of(existingShift10)); // Existing is shift 10, request is shift 20
        when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> {
            AttendanceRecord r = inv.getArgument(0);
            assertNotEquals(777L, r.getId(), "Must not overwrite existing shift 10 record");
            r.setId(888L);
            return r;
        });

        AttendanceHistoryDto resultDifferentShift = attendanceService.createManualRecord(dtoOtherShift);
        assertEquals(888L, resultDifferentShift.getId());
        assertEquals("Ca đêm", resultDifferentShift.getShiftName());
    }

    @Test
    @DisplayName("ST5-05: createManualRecord throws BusinessException when checkOut <= checkIn, and ResourceNotFoundException when user missing")
    void createManualRecord_ValidationErrors_ThrowsBusinessAndNotFoundExceptions() {
        LocalDateTime checkIn = LocalDateTime.of(2026, 10, 24, 8, 0);

        // checkOut before checkIn
        ManualAttendanceRequestDto dtoBefore = ManualAttendanceRequestDto.builder()
                .userId(1L)
                .checkInTime(checkIn)
                .checkOutTime(LocalDateTime.of(2026, 10, 24, 7, 50))
                .build();

        BusinessException exBefore = assertThrows(BusinessException.class, () -> attendanceService.createManualRecord(dtoBefore));
        assertEquals("Thời gian ra ca phải sau thời gian vào ca", exBefore.getMessage());

        // checkOut equals checkIn
        ManualAttendanceRequestDto dtoEqual = ManualAttendanceRequestDto.builder()
                .userId(1L)
                .checkInTime(checkIn)
                .checkOutTime(checkIn)
                .build();

        BusinessException exEqual = assertThrows(BusinessException.class, () -> attendanceService.createManualRecord(dtoEqual));
        assertEquals("Thời gian ra ca phải sau thời gian vào ca", exEqual.getMessage());

        // User not found
        ManualAttendanceRequestDto dtoUserNotFound = ManualAttendanceRequestDto.builder()
                .userId(999L)
                .checkInTime(checkIn)
                .build();

        when(userRepository.findById(999L)).thenReturn(Optional.empty());
        ResourceNotFoundException exUser = assertThrows(ResourceNotFoundException.class, () -> attendanceService.createManualRecord(dtoUserNotFound));
        assertTrue(exUser.getMessage().contains("999"));
    }

    @Test
    @DisplayName("ST5-05: updateManualRecord updates existing record when id > 0, and creates record via EmployeeShift when id < 0")
    void updateManualRecord_Success_HandlesPositiveAndNegativeIds() {
        LocalDateTime inTime = LocalDateTime.of(2026, 10, 24, 8, 0);
        LocalDateTime outTime = LocalDateTime.of(2026, 10, 24, 17, 0);

        // 1. id > 0: updates existing record
        AttendanceRecord existing = AttendanceRecord.builder()
                .id(100L)
                .user(sampleUser)
                .shift(sampleShift)
                .checkInTime(LocalDateTime.of(2026, 10, 24, 8, 30))
                .status("LATE")
                .build();

        ManualAttendanceRequestDto dtoUpdate = ManualAttendanceRequestDto.builder()
                .shiftId(10L)
                .checkInTime(inTime)
                .checkOutTime(outTime)
                .build();

        when(attendanceRecordRepository.findById(100L)).thenReturn(Optional.of(existing));
        when(shiftRepository.findById(10L)).thenReturn(Optional.of(sampleShift));
        when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        AttendanceHistoryDto resPositive = attendanceService.updateManualRecord(100L, dtoUpdate);
        assertNotNull(resPositive);
        assertEquals(100L, resPositive.getId());
        assertEquals("ON_TIME", resPositive.getStatus());
        assertEquals(inTime, existing.getCheckInTime());
        assertEquals(outTime, existing.getCheckOutTime());

        // 2. id < 0: looks up EmployeeShift with id = -id and delegates to createManualRecord
        EmployeeShift es = new EmployeeShift();
        es.setId(42L);
        es.setUser(sampleUser);
        es.setShift(sampleShift);
        es.setAssignedDate(LocalDate.of(2026, 10, 24));

        when(employeeShiftRepository.findById(42L)).thenReturn(Optional.of(es));
        when(userRepository.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(eq(1L), any(), any()))
                .thenReturn(Collections.emptyList());
        when(attendanceRecordRepository.save(any(AttendanceRecord.class))).thenAnswer(inv -> {
            AttendanceRecord r = inv.getArgument(0);
            r.setId(999L);
            return r;
        });

        ManualAttendanceRequestDto dtoNegative = ManualAttendanceRequestDto.builder()
                .checkInTime(inTime)
                .checkOutTime(outTime)
                .build();

        AttendanceHistoryDto resNegative = attendanceService.updateManualRecord(-42L, dtoNegative);
        assertNotNull(resNegative);
        assertEquals(999L, resNegative.getId());
        assertEquals("ON_TIME", resNegative.getStatus());
        assertEquals("Ca hành chính", resNegative.getShiftName());
        assertEquals("Ngô Văn Dũng", resNegative.getFullName());
        verify(employeeShiftRepository).findById(42L);
    }
}
