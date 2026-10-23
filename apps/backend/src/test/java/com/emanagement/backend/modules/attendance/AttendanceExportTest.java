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

import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.employee.User;
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
    private StorageService storageService;

    @Mock
    private jakarta.persistence.EntityManager entityManager;

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
}
