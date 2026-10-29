package com.emanagement.backend.modules.shift;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.LongStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.auth.Role;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.employee.dto.EmployeeResponseDto;
import com.emanagement.backend.modules.leave.LeaveRequestRepository;
import com.emanagement.backend.modules.notification.NotificationService;
import com.emanagement.backend.modules.shift.dto.EmployeeShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.BulkAssignDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftUpdateDto;
import com.emanagement.backend.modules.shift.dto.WeeklyScheduleResponseDto;

@ExtendWith(MockitoExtension.class)
class ShiftServiceImplTest {

    @Mock
    private ShiftRepository shiftRepository;

    @Mock
    private EmployeeShiftRepository employeeShiftRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private LeaveRequestRepository leaveRequestRepository;

    @Mock
    private AttendanceRecordRepository attendanceRecordRepository;

    @Mock
    private StorageService storageService;

    @InjectMocks
    private ShiftServiceImpl shiftService;

    private Shift existingShift;

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void bulkAssign_RejectsMoreThan100ExplicitEmployeesBeforeLoadingData(boolean dryRun) {
        BulkAssignDto dto = new BulkAssignDto();
        dto.setUserIds(LongStream.rangeClosed(1, 101).boxed().toList());
        dto.setDryRun(dryRun);

        BusinessException error = assertThrows(BusinessException.class, () -> shiftService.bulkAssign(dto));

        assertTrue(error.getMessage().contains("100"));
        verifyNoInteractions(userRepository, shiftRepository, employeeShiftRepository, notificationService);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void bulkAssign_RejectsAllModeWhenMoreThan100Employees(boolean dryRun) {
        LocalDate day = LocalDate.now().plusDays(1);
        BulkAssignDto dto = new BulkAssignDto(List.of(), 1L, day, day,
                Set.of(day.getDayOfWeek()), false, dryRun);
        List<User> users = bulkUsers(101);
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));
        when(userRepository.findActiveEmployees()).thenReturn(users);

        BusinessException error = assertThrows(BusinessException.class, () -> shiftService.bulkAssign(dto));

        assertTrue(error.getMessage().contains("101"));
        verifyNoInteractions(employeeShiftRepository, leaveRequestRepository,
                attendanceRecordRepository, notificationService);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void bulkAssign_AllowsExactly100Employees(boolean dryRun) {
        LocalDate day = LocalDate.now().plusDays(1);
        List<User> users = bulkUsers(100);
        BulkAssignDto dto = new BulkAssignDto(users.stream().map(User::getId).toList(), 1L,
                day, day, Set.of(day.getDayOfWeek()), false, dryRun);
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));
        when(userRepository.findAllById(any())).thenReturn(users);

        assertEquals(100, shiftService.bulkAssign(dto).getCreated());
        if (dryRun) {
            verify(employeeShiftRepository, never()).saveAll(any());
            verifyNoInteractions(notificationService);
        } else {
            verify(employeeShiftRepository).saveAll(argThat(items -> ((List<?>) items).size() == 100));
            verify(notificationService, times(100)).notifyUser(any(), any(), anyString(), anyString(), any());
        }
    }

    private List<User> bulkUsers(int count) {
        return LongStream.rangeClosed(1, count).mapToObj(id -> {
            User user = new User();
            user.setId(id);
            user.setEmployeeCode("EMP-" + id);
            user.setFullName("Employee " + id);
            user.setStatus("ACTIVE");
            return user;
        }).toList();
    }

    @BeforeEach
    void setUp() {
        existingShift = Shift.builder()
                .id(1L)
                .shiftCode("SHIFT-001")
                .name("Ca Hành Chính")
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(17, 30))
                .gracePeriodMinutes(15)
                .active(true)
                .build();
    }

    // =========================================================================
    // createShift Tests
    // =========================================================================

    @Test
    @DisplayName("createShift succeeds with valid time range (08:00 - 17:00)")
    void createShift_Success_WithValidTimeRange() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca Chuẩn");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(17, 0));
        dto.setGracePeriodMinutes(15);

        when(shiftRepository.findByShiftCode(anyString())).thenReturn(Optional.empty());
        when(shiftRepository.save(any(Shift.class))).thenAnswer(inv -> {
            Shift s = inv.getArgument(0);
            s.setId(10L);
            return s;
        });

        ShiftResponseDto result = shiftService.createShift(dto);

        assertNotNull(result);
        assertEquals(10L, result.getId());
        assertEquals("Ca Chuẩn", result.getName());
        assertEquals(LocalTime.of(8, 0), result.getStartTime());
        assertEquals(LocalTime.of(17, 0), result.getEndTime());
        assertEquals(15, result.getGracePeriodMinutes());
        verify(shiftRepository).save(any(Shift.class));
    }

    @Test
    @DisplayName("createShift succeeds with boundary duration of exactly 30 minutes")
    void createShift_Success_WithBoundary30Minutes() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca Ngắn");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(8, 30));
        dto.setGracePeriodMinutes(10);

        when(shiftRepository.findByShiftCode(anyString())).thenReturn(Optional.empty());
        when(shiftRepository.save(any(Shift.class))).thenAnswer(inv -> {
            Shift s = inv.getArgument(0);
            s.setId(11L);
            return s;
        });

        ShiftResponseDto result = shiftService.createShift(dto);

        assertNotNull(result);
        assertEquals(11L, result.getId());
        assertEquals(LocalTime.of(8, 0), result.getStartTime());
        assertEquals(LocalTime.of(8, 30), result.getEndTime());
    }

    @Test
    @DisplayName("createShift succeeds with boundary duration of exactly 16 hours")
    void createShift_Success_WithBoundary16Hours() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca Dài Tối Đa");
        dto.setStartTime(LocalTime.of(6, 0));
        dto.setEndTime(LocalTime.of(22, 0));
        dto.setGracePeriodMinutes(15);

        when(shiftRepository.findByShiftCode(anyString())).thenReturn(Optional.empty());
        when(shiftRepository.save(any(Shift.class))).thenAnswer(inv -> {
            Shift s = inv.getArgument(0);
            s.setId(12L);
            return s;
        });

        ShiftResponseDto result = shiftService.createShift(dto);

        assertNotNull(result);
        assertEquals(12L, result.getId());
        assertEquals(LocalTime.of(6, 0), result.getStartTime());
        assertEquals(LocalTime.of(22, 0), result.getEndTime());
    }

    @Test
    @DisplayName("createShift throws BusinessException when startTime is null")
    void createShift_ThrowsException_WhenStartTimeIsNull() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca Thiếu Giờ");
        dto.setStartTime(null);
        dto.setEndTime(LocalTime.of(17, 0));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.createShift(dto));
        assertEquals("Giờ bắt đầu và giờ kết thúc ca không được để trống", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("createShift throws BusinessException when endTime is null")
    void createShift_ThrowsException_WhenEndTimeIsNull() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca Thiếu Giờ");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(null);

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.createShift(dto));
        assertEquals("Giờ bắt đầu và giờ kết thúc ca không được để trống", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("createShift throws BusinessException when both startTime and endTime are null")
    void createShift_ThrowsException_WhenBothTimesAreNull() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca Thiếu Cả Hai Giờ");
        dto.setStartTime(null);
        dto.setEndTime(null);

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.createShift(dto));
        assertEquals("Giờ bắt đầu và giờ kết thúc ca không được để trống", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("createShift throws BusinessException when endTime is before startTime")
    void createShift_ThrowsException_WhenEndTimeIsBeforeStartTime() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca Qua Đêm Không Hợp Lệ");
        dto.setStartTime(LocalTime.of(17, 0));
        dto.setEndTime(LocalTime.of(8, 0));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.createShift(dto));
        assertEquals("Giờ kết thúc phải sau giờ bắt đầu (hiện chưa hỗ trợ ca qua đêm)", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("createShift throws BusinessException when endTime equals startTime")
    void createShift_ThrowsException_WhenEndTimeEqualsStartTime() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca Thời Lượng Bằng 0");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(8, 0));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.createShift(dto));
        assertEquals("Giờ kết thúc phải sau giờ bắt đầu (hiện chưa hỗ trợ ca qua đêm)", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("createShift throws BusinessException when duration is less than 30 minutes (e.g. 20 minutes)")
    void createShift_ThrowsException_WhenDurationLessThan30Minutes() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca Quá Ngắn");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(8, 20));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.createShift(dto));
        assertEquals("Thời lượng ca làm việc tối thiểu phải từ 30 phút trở lên", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("createShift throws BusinessException when duration is 29 minutes")
    void createShift_ThrowsException_WhenDurationIs29Minutes() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca 29 Phút");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(8, 29));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.createShift(dto));
        assertEquals("Thời lượng ca làm việc tối thiểu phải từ 30 phút trở lên", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("createShift throws BusinessException when duration exceeds 16 hours (e.g. 17 hours)")
    void createShift_ThrowsException_WhenDurationExceeds16Hours() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca Quá Dài");
        dto.setStartTime(LocalTime.of(6, 0));
        dto.setEndTime(LocalTime.of(23, 0));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.createShift(dto));
        assertEquals("Thời lượng ca làm việc tối đa không được vượt quá 16 giờ", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("createShift throws BusinessException when duration is 16 hours and 1 minute")
    void createShift_ThrowsException_WhenDurationIs16HoursAnd1Minute() {
        ShiftCreateDto dto = new ShiftCreateDto();
        dto.setName("Ca 16 Giờ 1 Phút");
        dto.setStartTime(LocalTime.of(6, 0));
        dto.setEndTime(LocalTime.of(22, 1));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.createShift(dto));
        assertEquals("Thời lượng ca làm việc tối đa không được vượt quá 16 giờ", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    // =========================================================================
    // updateShift Tests
    // =========================================================================

    @Test
    @DisplayName("updateShift succeeds with valid time range (08:00 - 17:00)")
    void updateShift_Success_WithValidTimeRange() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));
        when(shiftRepository.save(any(Shift.class))).thenAnswer(inv -> inv.getArgument(0));
        when(employeeShiftRepository.findByShiftIdAndAssignedDateGreaterThanEqual(eq(1L), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca Hành Chính Mới");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(17, 0));
        dto.setGracePeriodMinutes(15);
        dto.setEffectiveFrom(LocalDate.now().plusDays(1));

        ShiftResponseDto result = shiftService.updateShift(1L, dto);

        assertNotNull(result);
        assertEquals("Ca Hành Chính Mới", result.getName());
        assertEquals(LocalTime.of(8, 0), result.getStartTime());
        assertEquals(LocalTime.of(17, 0), result.getEndTime());
        verify(shiftRepository).save(existingShift);
    }

    @Test
    @DisplayName("updateShift succeeds with boundary duration of exactly 30 minutes")
    void updateShift_Success_WithBoundary30Minutes() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));
        when(shiftRepository.save(any(Shift.class))).thenAnswer(inv -> inv.getArgument(0));
        when(employeeShiftRepository.findByShiftIdAndAssignedDateGreaterThanEqual(eq(1L), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca 30 Phút");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(8, 30));
        dto.setGracePeriodMinutes(15);
        dto.setEffectiveFrom(LocalDate.now().plusDays(1));

        ShiftResponseDto result = shiftService.updateShift(1L, dto);

        assertNotNull(result);
        assertEquals(LocalTime.of(8, 0), result.getStartTime());
        assertEquals(LocalTime.of(8, 30), result.getEndTime());
    }

    @Test
    @DisplayName("updateShift succeeds with boundary duration of exactly 16 hours")
    void updateShift_Success_WithBoundary16Hours() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));
        when(shiftRepository.save(any(Shift.class))).thenAnswer(inv -> inv.getArgument(0));
        when(employeeShiftRepository.findByShiftIdAndAssignedDateGreaterThanEqual(eq(1L), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca 16 Giờ");
        dto.setStartTime(LocalTime.of(6, 0));
        dto.setEndTime(LocalTime.of(22, 0));
        dto.setGracePeriodMinutes(15);
        dto.setEffectiveFrom(LocalDate.now().plusDays(1));

        ShiftResponseDto result = shiftService.updateShift(1L, dto);

        assertNotNull(result);
        assertEquals(LocalTime.of(6, 0), result.getStartTime());
        assertEquals(LocalTime.of(22, 0), result.getEndTime());
    }

    @Test
    @DisplayName("updateShift throws BusinessException when startTime is null")
    void updateShift_ThrowsException_WhenStartTimeIsNull() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca Thiếu Giờ");
        dto.setStartTime(null);
        dto.setEndTime(LocalTime.of(17, 0));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.updateShift(1L, dto));
        assertEquals("Giờ bắt đầu và giờ kết thúc ca không được để trống", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateShift throws BusinessException when endTime is null")
    void updateShift_ThrowsException_WhenEndTimeIsNull() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca Thiếu Giờ");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(null);

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.updateShift(1L, dto));
        assertEquals("Giờ bắt đầu và giờ kết thúc ca không được để trống", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateShift throws BusinessException when both startTime and endTime are null")
    void updateShift_ThrowsException_WhenBothTimesAreNull() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca Thiếu Cả Hai Giờ");
        dto.setStartTime(null);
        dto.setEndTime(null);

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.updateShift(1L, dto));
        assertEquals("Giờ bắt đầu và giờ kết thúc ca không được để trống", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateShift throws BusinessException when endTime is before startTime")
    void updateShift_ThrowsException_WhenEndTimeIsBeforeStartTime() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca Qua Đêm Không Hợp Lệ");
        dto.setStartTime(LocalTime.of(17, 0));
        dto.setEndTime(LocalTime.of(8, 0));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.updateShift(1L, dto));
        assertEquals("Giờ kết thúc phải sau giờ bắt đầu (hiện chưa hỗ trợ ca qua đêm)", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateShift throws BusinessException when endTime equals startTime")
    void updateShift_ThrowsException_WhenEndTimeEqualsStartTime() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca Không Có Thời Lượng");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(8, 0));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.updateShift(1L, dto));
        assertEquals("Giờ kết thúc phải sau giờ bắt đầu (hiện chưa hỗ trợ ca qua đêm)", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateShift throws BusinessException when duration is less than 30 minutes")
    void updateShift_ThrowsException_WhenDurationLessThan30Minutes() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca 20 Phút");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(8, 20));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.updateShift(1L, dto));
        assertEquals("Thời lượng ca làm việc tối thiểu phải từ 30 phút trở lên", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateShift throws BusinessException when duration is 29 minutes")
    void updateShift_ThrowsException_WhenDurationIs29Minutes() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca 29 Phút");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(8, 29));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.updateShift(1L, dto));
        assertEquals("Thời lượng ca làm việc tối thiểu phải từ 30 phút trở lên", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateShift throws BusinessException when duration exceeds 16 hours")
    void updateShift_ThrowsException_WhenDurationExceeds16Hours() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca 17 Giờ");
        dto.setStartTime(LocalTime.of(6, 0));
        dto.setEndTime(LocalTime.of(23, 0));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.updateShift(1L, dto));
        assertEquals("Thời lượng ca làm việc tối đa không được vượt quá 16 giờ", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateShift throws BusinessException when duration is 16 hours and 1 minute")
    void updateShift_ThrowsException_WhenDurationIs16HoursAnd1Minute() {
        when(shiftRepository.findById(1L)).thenReturn(Optional.of(existingShift));

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca 16 Giờ 1 Phút");
        dto.setStartTime(LocalTime.of(6, 0));
        dto.setEndTime(LocalTime.of(22, 1));

        BusinessException ex = assertThrows(BusinessException.class, () -> shiftService.updateShift(1L, dto));
        assertEquals("Thời lượng ca làm việc tối đa không được vượt quá 16 giờ", ex.getMessage());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateShift throws ResourceNotFoundException when shift does not exist")
    void updateShift_ThrowsException_WhenShiftNotFound() {
        when(shiftRepository.findById(999L)).thenReturn(Optional.empty());

        ShiftUpdateDto dto = new ShiftUpdateDto();
        dto.setName("Ca Không Tồn Tại");
        dto.setStartTime(LocalTime.of(8, 0));
        dto.setEndTime(LocalTime.of(17, 0));

        assertThrows(ResourceNotFoundException.class, () -> shiftService.updateShift(999L, dto));
        verify(shiftRepository, never()).save(any());
    }

    // =========================================================================
    // getWeeklySchedulePaged Tests
    // =========================================================================

    private User createTestUser(Long id, String employeeCode, String fullName, String email, String avatarKey) {
        return User.builder()
                .id(id)
                .employeeCode(employeeCode)
                .fullName(fullName)
                .email(email)
                .phone("090" + id)
                .avatarUrl(avatarKey)
                .status("ACTIVE")
                .roles(Set.of(new Role(1L, "ROLE_USER", "Nhân viên")))
                .createdAt(LocalDateTime.of(2026, 1, 1, 8, 0))
                .build();
    }

    private EmployeeShift createTestEmployeeShift(Long id, User user, Shift shift, LocalDate assignedDate) {
        EmployeeShift es = new EmployeeShift();
        es.setId(id);
        es.setUser(user);
        es.setShift(shift);
        es.setAssignedDate(assignedDate);
        es.setShiftName(shift.getName());
        es.setStartTime(shift.getStartTime());
        es.setEndTime(shift.getEndTime());
        es.setGracePeriodMinutes(shift.getGracePeriodMinutes());
        es.setCreatedAt(LocalDateTime.now());
        return es;
    }

    @Test
    @DisplayName("getWeeklySchedulePaged succeeds with paged employees, presigned avatars, and sorted assignments")
    void getWeeklySchedulePaged_Success_ReturnsEmployeesWithPresignedUrlAndSortedAssignments() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        String keyword = "Nguyen";
        int page = 0;
        int size = 10;

        User user1 = createTestUser(101L, "EMP101", "Nguyen Van A", "a@example.com", "avatars/u101.jpg");
        User user2 = createTestUser(102L, "EMP102", "Nguyen Van B", "b@example.com", "avatars/u102.jpg");

        Page<User> usersPage = new PageImpl<>(List.of(user1, user2), PageRequest.of(page, size), 2);
        when(userRepository.findEmployeesForWeeklySchedule(eq("Nguyen"), eq(startDate), eq(endDate), eq(PageRequest.of(page, size))))
                .thenReturn(usersPage);

        when(storageService.getPresignedUrl("avatars/u101.jpg", 60)).thenReturn("https://minio.local/presigned/u101.jpg");
        when(storageService.getPresignedUrl("avatars/u102.jpg", 60)).thenReturn("https://minio.local/presigned/u102.jpg");

        // Decouple id and assignedDate to strictly test sort: assignedDate ASC, id ASC
        // Date 20: id=50, id=10
        // Date 22: id=25, id=5
        // Expected sort:
        // 1. (Date 20, id=10)
        // 2. (Date 20, id=50)
        // 3. (Date 22, id=5)
        // 4. (Date 22, id=25)
        EmployeeShift es1 = createTestEmployeeShift(50L, user1, existingShift, LocalDate.of(2026, 10, 20));
        EmployeeShift es2 = createTestEmployeeShift(10L, user2, existingShift, LocalDate.of(2026, 10, 20));
        EmployeeShift es3 = createTestEmployeeShift(25L, user2, existingShift, LocalDate.of(2026, 10, 22));
        EmployeeShift es4 = createTestEmployeeShift(5L, user1, existingShift, LocalDate.of(2026, 10, 22));

        when(employeeShiftRepository.findByUserIdInAndAssignedDateBetween(List.of(101L, 102L), startDate, endDate))
                .thenReturn(List.of(es1, es3, es4, es2));

        WeeklyScheduleResponseDto result = shiftService.getWeeklySchedulePaged(startDate, endDate, page, size, keyword);

        assertNotNull(result);

        // Verify employees page response
        PageResponse<EmployeeResponseDto> employees = result.getEmployees();
        assertNotNull(employees);
        assertEquals(0, employees.getPageNumber());
        assertEquals(10, employees.getPageSize());
        assertEquals(2, employees.getTotalElement());
        assertEquals(1, employees.getTotalPages());
        assertEquals(2, employees.getContent().size());

        EmployeeResponseDto empDto1 = employees.getContent().get(0);
        assertEquals(101L, empDto1.getId());
        assertEquals("EMP101", empDto1.getEmployeeCode());
        assertEquals("Nguyen Van A", empDto1.getFullName());
        assertEquals("a@example.com", empDto1.getEmail());
        assertEquals("090101", empDto1.getPhone());
        assertEquals("https://minio.local/presigned/u101.jpg", empDto1.getAvatarUrl());
        assertEquals("ACTIVE", empDto1.getStatus());
        assertFalse(empDto1.isHasRegisteredFace());
        assertEquals(LocalDateTime.of(2026, 1, 1, 8, 0), empDto1.getCreatedAt());
        assertEquals(Set.of("ROLE_USER"), empDto1.getRoles());

        EmployeeResponseDto empDto2 = employees.getContent().get(1);
        assertEquals(102L, empDto2.getId());
        assertEquals("EMP102", empDto2.getEmployeeCode());
        assertEquals("Nguyen Van B", empDto2.getFullName());
        assertEquals("b@example.com", empDto2.getEmail());
        assertEquals("090102", empDto2.getPhone());
        assertEquals("https://minio.local/presigned/u102.jpg", empDto2.getAvatarUrl());
        assertEquals("ACTIVE", empDto2.getStatus());
        assertFalse(empDto2.isHasRegisteredFace());
        assertEquals(LocalDateTime.of(2026, 1, 1, 8, 0), empDto2.getCreatedAt());
        assertEquals(Set.of("ROLE_USER"), empDto2.getRoles());

        // Verify assignments sorted strictly by assignedDate ASC, id ASC
        List<EmployeeShiftResponseDto> assignments = result.getAssignments();
        assertNotNull(assignments);
        assertEquals(4, assignments.size());

        // 1st: es2 (2026-10-20, id=10)
        assertEquals(10L, assignments.get(0).getId());
        assertEquals(102L, assignments.get(0).getUserId());
        assertEquals("EMP102", assignments.get(0).getEmployeeCode());
        assertEquals("Nguyen Van B", assignments.get(0).getFullName());
        assertEquals(1L, assignments.get(0).getShiftId());
        assertEquals("Ca Hành Chính", assignments.get(0).getShiftName());
        assertEquals("SHIFT-001", assignments.get(0).getShiftCode());
        assertEquals(LocalTime.of(8, 0), assignments.get(0).getStartTime());
        assertEquals(LocalTime.of(17, 30), assignments.get(0).getEndTime());
        assertEquals(15, assignments.get(0).getGracePeriodMinutes());
        assertEquals(LocalDate.of(2026, 10, 20), assignments.get(0).getAssignedDate());

        // 2nd: es1 (2026-10-20, id=50)
        assertEquals(50L, assignments.get(1).getId());
        assertEquals(101L, assignments.get(1).getUserId());
        assertEquals("EMP101", assignments.get(1).getEmployeeCode());
        assertEquals("Nguyen Van A", assignments.get(1).getFullName());
        assertEquals(1L, assignments.get(1).getShiftId());
        assertEquals("Ca Hành Chính", assignments.get(1).getShiftName());
        assertEquals("SHIFT-001", assignments.get(1).getShiftCode());
        assertEquals(LocalTime.of(8, 0), assignments.get(1).getStartTime());
        assertEquals(LocalTime.of(17, 30), assignments.get(1).getEndTime());
        assertEquals(15, assignments.get(1).getGracePeriodMinutes());
        assertEquals(LocalDate.of(2026, 10, 20), assignments.get(1).getAssignedDate());

        // 3rd: es4 (2026-10-22, id=5)
        assertEquals(5L, assignments.get(2).getId());
        assertEquals(101L, assignments.get(2).getUserId());
        assertEquals("EMP101", assignments.get(2).getEmployeeCode());
        assertEquals("Nguyen Van A", assignments.get(2).getFullName());
        assertEquals(LocalDate.of(2026, 10, 22), assignments.get(2).getAssignedDate());

        // 4th: es3 (2026-10-22, id=25)
        assertEquals(25L, assignments.get(3).getId());
        assertEquals(102L, assignments.get(3).getUserId());
        assertEquals("EMP102", assignments.get(3).getEmployeeCode());
        assertEquals("Nguyen Van B", assignments.get(3).getFullName());
        assertEquals(LocalDate.of(2026, 10, 22), assignments.get(3).getAssignedDate());

        verify(userRepository).findEmployeesForWeeklySchedule("Nguyen", startDate, endDate, PageRequest.of(0, 10));
        verify(employeeShiftRepository).findByUserIdInAndAssignedDateBetween(List.of(101L, 102L), startDate, endDate);
        verify(storageService).getPresignedUrl("avatars/u101.jpg", 60);
        verify(storageService).getPresignedUrl("avatars/u102.jpg", 60);
    }

    @Test
    @DisplayName("getWeeklySchedulePaged maps user with null roles and null avatarUrl correctly")
    void getWeeklySchedulePaged_UserWithNullRolesAndAvatar_HandledSafely() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);

        User userWithoutRoles = User.builder()
                .id(201L)
                .employeeCode("EMP201")
                .fullName("User No Roles")
                .roles(null)
                .avatarUrl(null)
                .build();

        Page<User> usersPage = new PageImpl<>(List.of(userWithoutRoles), PageRequest.of(0, 20), 1);
        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), any(Pageable.class)))
                .thenReturn(usersPage);
        when(storageService.getPresignedUrl(null, 60)).thenReturn(null);
        when(employeeShiftRepository.findByUserIdInAndAssignedDateBetween(List.of(201L), startDate, endDate))
                .thenReturn(Collections.emptyList());

        WeeklyScheduleResponseDto result = shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, null);

        assertNotNull(result);
        assertEquals(1, result.getEmployees().getContent().size());
        EmployeeResponseDto empDto = result.getEmployees().getContent().get(0);
        assertNotNull(empDto.getRoles());
        assertTrue(empDto.getRoles().isEmpty());
        assertNull(empDto.getAvatarUrl());
        verify(storageService).getPresignedUrl(null, 60);
    }

    @Test
    @DisplayName("getWeeklySchedulePaged maps user with multiple roles correctly")
    void getWeeklySchedulePaged_MapsUserWithMultipleRolesCorrectly() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);

        User userWithRoles = User.builder()
                .id(202L)
                .employeeCode("EMP202")
                .fullName("Multi Role User")
                .roles(Set.of(
                        new Role(1L, "ROLE_EMPLOYEE", "Nhân viên"),
                        new Role(2L, "ROLE_MANAGER", "Quản lý")
                ))
                .avatarUrl("avatars/u202.png")
                .build();

        Page<User> usersPage = new PageImpl<>(List.of(userWithRoles), PageRequest.of(0, 20), 1);
        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), any(Pageable.class)))
                .thenReturn(usersPage);
        when(storageService.getPresignedUrl("avatars/u202.png", 60)).thenReturn("https://minio.local/presigned/u202.png");
        when(employeeShiftRepository.findByUserIdInAndAssignedDateBetween(List.of(202L), startDate, endDate))
                .thenReturn(Collections.emptyList());

        WeeklyScheduleResponseDto result = shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, null);

        assertNotNull(result);
        assertEquals(1, result.getEmployees().getContent().size());
        EmployeeResponseDto empDto = result.getEmployees().getContent().get(0);
        assertEquals(2, empDto.getRoles().size());
        assertTrue(empDto.getRoles().contains("ROLE_EMPLOYEE"));
        assertTrue(empDto.getRoles().contains("ROLE_MANAGER"));
        assertEquals("https://minio.local/presigned/u202.png", empDto.getAvatarUrl());
        verify(storageService).getPresignedUrl("avatars/u202.png", 60);
    }

    @Test
    @DisplayName("getWeeklySchedulePaged normalizes page < 0 to 0 (boundaries: -1 and -10)")
    void getWeeklySchedulePaged_NormalizesNegativePage_ToZero() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 20))))
                .thenReturn(Page.empty());

        // Boundary -1
        shiftService.getWeeklySchedulePaged(startDate, endDate, -1, 20, null);
        // Deep negative -10
        shiftService.getWeeklySchedulePaged(startDate, endDate, -10, 20, null);

        verify(userRepository, times(2)).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 20)));
    }

    @Test
    @DisplayName("getWeeklySchedulePaged preserves non-negative page index (page = 0 and page = 2)")
    void getWeeklySchedulePaged_PreservesNonNegativePage_Correctly() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), any(Pageable.class)))
                .thenReturn(Page.empty());

        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, null);
        shiftService.getWeeklySchedulePaged(startDate, endDate, 2, 20, null);

        verify(userRepository).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 20)));
        verify(userRepository).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(2, 20)));
    }

    @Test
    @DisplayName("getWeeklySchedulePaged normalizes size <= 0 to 1 (boundaries: 0, -1, -50)")
    void getWeeklySchedulePaged_NormalizesNonPositiveSize_ToOne() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 1))))
                .thenReturn(Page.empty());

        // Test size = 0
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 0, null);
        // Test size = -1
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, -1, null);
        // Test size = -50
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, -50, null);

        verify(userRepository, times(3)).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 1)));
    }

    @Test
    @DisplayName("getWeeklySchedulePaged preserves valid size within [1, 100] (boundaries: 1, 50, 100)")
    void getWeeklySchedulePaged_PreservesValidSize_WithinRange() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), any(Pageable.class)))
                .thenReturn(Page.empty());

        // Min boundary: 1
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 1, null);
        // Mid value: 50
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 50, null);
        // Max boundary: 100
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 100, null);

        verify(userRepository).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 1)));
        verify(userRepository).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 50)));
        verify(userRepository).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 100)));
    }

    @Test
    @DisplayName("getWeeklySchedulePaged normalizes size > 100 to 100 (boundaries: 101, 500)")
    void getWeeklySchedulePaged_NormalizesSizeExceeding100_To100() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 100))))
                .thenReturn(Page.empty());

        // Boundary + 1: 101
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 101, null);
        // Large size: 500
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 500, null);

        verify(userRepository, times(2)).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 100)));
    }

    @Test
    @DisplayName("getWeeklySchedulePaged trims keyword with leading and trailing whitespaces, tabs, newlines")
    void getWeeklySchedulePaged_TrimsKeywordWithWhitespace() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        when(userRepository.findEmployeesForWeeklySchedule(eq("EMP001"), eq(startDate), eq(endDate), eq(PageRequest.of(0, 20))))
                .thenReturn(Page.empty());

        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, "  EMP001  ");
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, "\t\n  EMP001  \t\n");

        verify(userRepository, times(2)).findEmployeesForWeeklySchedule(eq("EMP001"), eq(startDate), eq(endDate), eq(PageRequest.of(0, 20)));
    }

    @Test
    @DisplayName("getWeeklySchedulePaged normalizes blank, empty, and whitespace-only keyword to null")
    void getWeeklySchedulePaged_NormalizesBlankKeyword_ToNull() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 20))))
                .thenReturn(Page.empty());

        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, null);
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, "");
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, "   ");
        shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, "\t \n ");

        verify(userRepository, times(4)).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 20)));
    }

    @Test
    @DisplayName("getWeeklySchedulePaged returns empty assignments and does not query shifts when users page is empty")
    void getWeeklySchedulePaged_WhenUsersPageIsEmpty_ReturnsEmptyAssignmentsAndSkipsShiftQuery() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);
        Page<User> emptyPage = new PageImpl<>(Collections.emptyList(), PageRequest.of(0, 20), 0);

        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 20))))
                .thenReturn(emptyPage);

        WeeklyScheduleResponseDto result = shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, null);

        assertNotNull(result);
        assertNotNull(result.getEmployees());
        assertTrue(result.getEmployees().getContent().isEmpty());
        assertEquals(0, result.getEmployees().getTotalElement());
        assertNotNull(result.getAssignments());
        assertTrue(result.getAssignments().isEmpty());

        verify(employeeShiftRepository, never()).findByUserIdInAndAssignedDateBetween(any(), any(), any());
    }

    @Test
    @DisplayName("getWeeklySchedulePaged returns employees and empty assignments when employees have no shifts in date range")
    void getWeeklySchedulePaged_WhenEmployeesHaveNoShifts_ReturnsEmployeesWithEmptyAssignments() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);
        LocalDate endDate = LocalDate.of(2026, 10, 25);

        User user1 = createTestUser(101L, "EMP101", "Nguyen Van A", "a@example.com", "avatars/u101.jpg");
        Page<User> usersPage = new PageImpl<>(List.of(user1), PageRequest.of(0, 20), 1);

        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), eq(PageRequest.of(0, 20))))
                .thenReturn(usersPage);
        when(storageService.getPresignedUrl("avatars/u101.jpg", 60)).thenReturn("https://minio.local/presigned/u101.jpg");
        when(employeeShiftRepository.findByUserIdInAndAssignedDateBetween(List.of(101L), startDate, endDate))
                .thenReturn(Collections.emptyList());

        WeeklyScheduleResponseDto result = shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, null);

        assertNotNull(result);
        assertEquals(1, result.getEmployees().getContent().size());
        assertNotNull(result.getAssignments());
        assertTrue(result.getAssignments().isEmpty());
        verify(employeeShiftRepository).findByUserIdInAndAssignedDateBetween(List.of(101L), startDate, endDate);
    }

    @Test
    @DisplayName("getWeeklySchedulePaged throws BusinessException when startDate is null")
    void getWeeklySchedulePaged_ThrowsException_WhenStartDateIsNull() {
        LocalDate endDate = LocalDate.of(2026, 10, 25);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> shiftService.getWeeklySchedulePaged(null, endDate, 0, 20, null));

        assertEquals("Ngày bắt đầu và ngày kết thúc không được để trống", ex.getMessage());
        verifyNoInteractions(userRepository, employeeShiftRepository, storageService);
    }

    @Test
    @DisplayName("getWeeklySchedulePaged throws BusinessException when endDate is null")
    void getWeeklySchedulePaged_ThrowsException_WhenEndDateIsNull() {
        LocalDate startDate = LocalDate.of(2026, 10, 19);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> shiftService.getWeeklySchedulePaged(startDate, null, 0, 20, null));

        assertEquals("Ngày bắt đầu và ngày kết thúc không được để trống", ex.getMessage());
        verifyNoInteractions(userRepository, employeeShiftRepository, storageService);
    }

    @Test
    @DisplayName("getWeeklySchedulePaged throws BusinessException when both startDate and endDate are null")
    void getWeeklySchedulePaged_ThrowsException_WhenBothDatesAreNull() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> shiftService.getWeeklySchedulePaged(null, null, 0, 20, null));

        assertEquals("Ngày bắt đầu và ngày kết thúc không được để trống", ex.getMessage());
        verifyNoInteractions(userRepository, employeeShiftRepository, storageService);
    }

    @Test
    @DisplayName("getWeeklySchedulePaged throws BusinessException when endDate is before startDate")
    void getWeeklySchedulePaged_ThrowsException_WhenEndDateIsBeforeStartDate() {
        LocalDate startDate = LocalDate.of(2026, 10, 25);
        LocalDate endDate = LocalDate.of(2026, 10, 24); // 1 day before

        BusinessException ex = assertThrows(BusinessException.class,
                () -> shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, null));

        assertEquals("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu", ex.getMessage());
        verifyNoInteractions(userRepository, employeeShiftRepository, storageService);
    }

    @Test
    @DisplayName("getWeeklySchedulePaged throws BusinessException when date range exceeds 92 days")
    void getWeeklySchedulePaged_ThrowsException_WhenDateRangeExceeds92Days() {
        LocalDate startDate = LocalDate.of(2026, 1, 1);
        LocalDate endDate = startDate.plusDays(93); // ChronoUnit.DAYS.between(startDate, endDate) == 93 > 92

        BusinessException ex = assertThrows(BusinessException.class,
                () -> shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, null));

        assertEquals("Chỉ được xem lịch tối đa 93 ngày mỗi lần", ex.getMessage());
        verifyNoInteractions(userRepository, employeeShiftRepository, storageService);
    }

    @Test
    @DisplayName("getWeeklySchedulePaged succeeds when date range is exactly 92 days (boundary)")
    void getWeeklySchedulePaged_Success_WhenDateRangeIsExactly92Days() {
        LocalDate startDate = LocalDate.of(2026, 1, 1);
        LocalDate endDate = startDate.plusDays(92); // ChronoUnit.DAYS.between(startDate, endDate) == 92 <= 92

        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), any(Pageable.class)))
                .thenReturn(Page.empty());

        assertDoesNotThrow(() -> shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, null));
        verify(userRepository).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), any(Pageable.class));
    }

    @Test
    @DisplayName("getWeeklySchedulePaged succeeds when startDate equals endDate (single day)")
    void getWeeklySchedulePaged_Success_WhenStartDateEqualsEndDate() {
        LocalDate singleDate = LocalDate.of(2026, 10, 20);

        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(singleDate), eq(singleDate), any(Pageable.class)))
                .thenReturn(Page.empty());

        assertDoesNotThrow(() -> shiftService.getWeeklySchedulePaged(singleDate, singleDate, 0, 20, null));
        verify(userRepository).findEmployeesForWeeklySchedule(isNull(), eq(singleDate), eq(singleDate), any(Pageable.class));
    }

    @Test
    @DisplayName("getWeeklySchedulePaged succeeds for standard 7-day week (startDate to startDate + 6 days)")
    void getWeeklySchedulePaged_Success_ForStandardSevenDayWeek() {
        LocalDate startDate = LocalDate.of(2026, 10, 19); // Monday
        LocalDate endDate = startDate.plusDays(6);        // Sunday (2026-10-25)

        when(userRepository.findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), any(Pageable.class)))
                .thenReturn(Page.empty());

        assertDoesNotThrow(() -> shiftService.getWeeklySchedulePaged(startDate, endDate, 0, 20, null));
        verify(userRepository).findEmployeesForWeeklySchedule(isNull(), eq(startDate), eq(endDate), any(Pageable.class));
    }
}

