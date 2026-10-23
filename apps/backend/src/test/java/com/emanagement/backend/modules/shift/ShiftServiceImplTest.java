package com.emanagement.backend.modules.shift;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.leave.LeaveRequestRepository;
import com.emanagement.backend.modules.notification.NotificationService;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftUpdateDto;

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

    @InjectMocks
    private ShiftServiceImpl shiftService;

    private Shift existingShift;

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
}

