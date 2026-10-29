package com.emanagement.backend.modules.leave;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.leave.dto.LeaveAprrovalDto;
import com.emanagement.backend.modules.leave.dto.LeaveRequestCreateDto;
import com.emanagement.backend.modules.leave.dto.LeaveRequestResponseDto;
import com.emanagement.backend.modules.shift.ShiftService;
import com.emanagement.backend.modules.notification.NotificationService;
import com.emanagement.backend.modules.notification.NotificationType;

import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LeaveRequestServiceImpl implements LeaveRequestService {
    private final LeaveRequestRepository leaveRequestRepository;
    private final UserRepository userRepository;
    private final ShiftService shiftService;
    private final NotificationService notificationService;

    @Override
    @Transactional(readOnly = true)
    public LeaveRequestResponseDto getById(Long id, Long viewerId, boolean admin) {
        LeaveRequest request = leaveRequestRepository.findById(id)
                .filter(r -> admin || r.getUser().getId().equals(viewerId))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn nghỉ phép"));
        return mapToDto(request);
    }

    @Override
    @Transactional
    public LeaveRequestResponseDto approveLeaveRequest(Long id, LeaveAprrovalDto dto) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn xin nghỉ phép với ID: " + id));

        User user = userRepository.findById(dto.getApprovedByUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy quản lý với ID: " + dto.getApprovedByUserId()));

        String previousStatus = leaveRequest.getStatus();
        leaveRequest.setStatus(dto.getStatus());
        leaveRequest.setApprovedBy(user);
        leaveRequest.setReviewNote(dto.getReviewNote() != null ? dto.getReviewNote().trim() : null);
        leaveRequest.setUpdatedAt(LocalDateTime.now());
        LeaveRequest updated = leaveRequestRepository.save(leaveRequest);

        // Đơn được duyệt -> tự hủy các ca đã phân trong khoảng nghỉ (và thông báo cho nhân viên)
        if ("APPROVED".equals(dto.getStatus())) {
            shiftService.cancelShiftsForLeave(leaveRequest.getUser(), leaveRequest.getStartDate(),
                    leaveRequest.getEndDate());
        }
        if (!java.util.Objects.equals(previousStatus, dto.getStatus())) {
            boolean approved = "APPROVED".equals(dto.getStatus());
            notificationService.notifyUser(updated.getUser(),
                    approved ? NotificationType.LEAVE_APPROVED : NotificationType.LEAVE_REJECTED,
                    approved ? "Đơn nghỉ phép đã được duyệt" : "Đơn nghỉ phép bị từ chối",
                    "Đơn nghỉ từ " + updated.getStartDate() + " đến " + updated.getEndDate()
                            + (updated.getReviewNote() == null || updated.getReviewNote().isBlank()
                            ? "." : ". Ghi chú: " + updated.getReviewNote()), updated.getId());
        }
        return mapToDto(updated);
    }

    @Override
    @Transactional
    public LeaveRequestResponseDto createLeaveRequest(LeaveRequestCreateDto dto) {
        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(
                        () -> new ResourceNotFoundException("Không tìm thấy nhân viên với ID: " + dto.getUserId()));

        if (dto.getEndDate().isBefore(dto.getStartDate())) {
            throw new BusinessException("Ngày kết thúc nghỉ không được trước ngày bắt đầu");
        }

        LeaveRequest leaveRequest = LeaveRequest.builder()
                .user(user)
                .startDate(dto.getStartDate())
                .endDate(dto.getEndDate())
                .reason(dto.getReason())
                .status("PENDING")
                .build();
        LeaveRequest created = leaveRequestRepository.save(leaveRequest);
        notificationService.notifyAdmins(NotificationType.LEAVE_REQUESTED, "Có đơn xin nghỉ mới",
                user.getFullName() + " (" + user.getEmployeeCode() + ") xin nghỉ từ " + created.getStartDate()
                        + " đến " + created.getEndDate() + ".", created.getId(),
                "/leave-requests?requestId=" + created.getId());
        return mapToDto(created);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<LeaveRequestResponseDto> getAllLeaveRequests(int page, int size, String status) {
        return getAllLeaveRequests(page, size, status, null, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<LeaveRequestResponseDto> getAllLeaveRequests(
            int page, int size, String status, LocalDate startDate, LocalDate endDate, String keyword) {
        PageRequest pageRequest = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));

        boolean hasStatus = status != null && !status.isBlank();
        boolean hasStartDate = startDate != null;
        boolean hasEndDate = endDate != null;
        boolean hasKeyword = keyword != null && !keyword.isBlank();

        Page<LeaveRequest> leavePage = leaveRequestRepository.findWithFilters(
                hasStatus, hasStatus ? status.trim() : null,
                hasStartDate, startDate,
                hasEndDate, endDate,
                hasKeyword, hasKeyword ? keyword.trim() : null,
                pageRequest);

        return PageResponse.from(leavePage.map(this::mapToDto));
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveRequestResponseDto> getMyLeaveRequests(Long userId) {
        return leaveRequestRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    private LeaveRequestResponseDto mapToDto(LeaveRequest leaveRequest) {
        return LeaveRequestResponseDto.builder()
                .id(leaveRequest.getId())
                .userId(leaveRequest.getUser().getId())
                .employeeCode(leaveRequest.getUser().getEmployeeCode())
                .fullName(leaveRequest.getUser().getFullName())
                .startDate(leaveRequest.getStartDate())
                .endDate(leaveRequest.getEndDate())
                .reason(leaveRequest.getReason())
                .status(leaveRequest.getStatus())
                .approvedByName(
                        leaveRequest.getApprovedBy() != null ? leaveRequest.getApprovedBy().getFullName() : null)
                .reviewNote(leaveRequest.getReviewNote())
                .createdAt(leaveRequest.getCreatedAt())
                .build();
    }
}
