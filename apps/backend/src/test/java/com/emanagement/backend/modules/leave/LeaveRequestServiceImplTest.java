package com.emanagement.backend.modules.leave;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.leave.dto.LeaveAprrovalDto;
import com.emanagement.backend.modules.leave.dto.LeaveRequestCreateDto;
import com.emanagement.backend.modules.leave.dto.LeaveRequestResponseDto;
import com.emanagement.backend.modules.shift.ShiftService;

@ExtendWith(MockitoExtension.class)
class LeaveRequestServiceImplTest {

    @Mock
    private LeaveRequestRepository leaveRequestRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ShiftService shiftService;

    @InjectMocks
    private LeaveRequestServiceImpl leaveRequestService;

    private User employee;
    private User manager;
    private LeaveRequest leaveRequest;

    @BeforeEach
    void setUp() {
        employee = User.builder()
                .id(1L)
                .employeeCode("EMP001")
                .fullName("Nguyen Van A")
                .email("nva@example.com")
                .build();

        manager = User.builder()
                .id(2L)
                .employeeCode("MGR001")
                .fullName("Tran Thi Quan Ly")
                .email("manager@example.com")
                .build();

        leaveRequest = LeaveRequest.builder()
                .id(10L)
                .user(employee)
                .startDate(LocalDate.of(2026, 11, 1))
                .endDate(LocalDate.of(2026, 11, 3))
                .reason("Nghỉ ốm")
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("Duyệt đơn nghỉ phép thành công với reviewNote")
    void approveLeaveRequest_WithReviewNote_ShouldSucceed() {
        LeaveAprrovalDto dto = new LeaveAprrovalDto(2L, "APPROVED", "Đã phê duyệt nghỉ 3 ngày.");

        when(leaveRequestRepository.findById(10L)).thenReturn(Optional.of(leaveRequest));
        when(userRepository.findById(2L)).thenReturn(Optional.of(manager));
        when(leaveRequestRepository.save(any(LeaveRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LeaveRequestResponseDto result = leaveRequestService.approveLeaveRequest(10L, dto);

        assertNotNull(result);
        assertEquals("APPROVED", result.getStatus());
        assertEquals("Tran Thi Quan Ly", result.getApprovedByName());
        assertEquals("Đã phê duyệt nghỉ 3 ngày.", result.getReviewNote());
        verify(shiftService).cancelShiftsForLeave(employee, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 3));
        verify(leaveRequestRepository).save(any(LeaveRequest.class));
    }

    @Test
    @DisplayName("Từ chối đơn nghỉ phép thành công với reviewNote (lý do từ chối)")
    void rejectLeaveRequest_WithReviewNote_ShouldSucceed() {
        LeaveAprrovalDto dto = new LeaveAprrovalDto(2L, "REJECTED", "Dự án đang gấp, đề nghị dời ngày.");

        when(leaveRequestRepository.findById(10L)).thenReturn(Optional.of(leaveRequest));
        when(userRepository.findById(2L)).thenReturn(Optional.of(manager));
        when(leaveRequestRepository.save(any(LeaveRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LeaveRequestResponseDto result = leaveRequestService.approveLeaveRequest(10L, dto);

        assertNotNull(result);
        assertEquals("REJECTED", result.getStatus());
        assertEquals("Tran Thi Quan Ly", result.getApprovedByName());
        assertEquals("Dự án đang gấp, đề nghị dời ngày.", result.getReviewNote());
        verify(shiftService, never()).cancelShiftsForLeave(any(), any(), any());
        verify(leaveRequestRepository).save(any(LeaveRequest.class));
    }

    @Test
    @DisplayName("Ném ResourceNotFoundException khi không tìm thấy đơn")
    void approveLeaveRequest_NotFound_ThrowsException() {
        LeaveAprrovalDto dto = new LeaveAprrovalDto(2L, "APPROVED", "OK");
        when(leaveRequestRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> leaveRequestService.approveLeaveRequest(99L, dto));
    }

    @Test
    @DisplayName("Tạo đơn nghỉ phép hợp lệ")
    void createLeaveRequest_Valid_ShouldSucceed() {
        LeaveRequestCreateDto createDto = new LeaveRequestCreateDto();
        createDto.setUserId(1L);
        createDto.setStartDate(LocalDate.of(2026, 11, 1));
        createDto.setEndDate(LocalDate.of(2026, 11, 2));
        createDto.setReason("Việc gia đình");

        when(userRepository.findById(1L)).thenReturn(Optional.of(employee));
        when(leaveRequestRepository.save(any(LeaveRequest.class))).thenAnswer(invocation -> {
            LeaveRequest req = invocation.getArgument(0);
            req.setId(100L);
            return req;
        });

        LeaveRequestResponseDto result = leaveRequestService.createLeaveRequest(createDto);

        assertNotNull(result);
        assertEquals("PENDING", result.getStatus());
        assertEquals("EMP001", result.getEmployeeCode());
        assertNull(result.getReviewNote());
    }

    @Test
    @DisplayName("Tạo đơn có endDate trước startDate ném BusinessException")
    void createLeaveRequest_EndDateBeforeStartDate_ThrowsBusinessException() {
        LeaveRequestCreateDto createDto = new LeaveRequestCreateDto();
        createDto.setUserId(1L);
        createDto.setStartDate(LocalDate.of(2026, 11, 5));
        createDto.setEndDate(LocalDate.of(2026, 11, 1));
        createDto.setReason("Lỗi ngày");

        when(userRepository.findById(1L)).thenReturn(Optional.of(employee));

        assertThrows(BusinessException.class, () -> leaveRequestService.createLeaveRequest(createDto));
    }
}
