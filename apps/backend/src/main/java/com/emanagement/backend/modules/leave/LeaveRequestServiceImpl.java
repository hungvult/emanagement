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

import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LeaveRequestServiceImpl implements LeaveRequestService {
    private final LeaveRequestRepository leaveRequestRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public LeaveRequestResponseDto approveLeaveRequest(Long id, LeaveAprrovalDto dto) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn xin nghỉ phép với ID: " + id));

        User user = userRepository.findById(dto.getApprovedByUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy quản lý với ID: " + dto.getApprovedByUserId()));

        leaveRequest.setStatus(dto.getStatus());
        leaveRequest.setApprovedBy(user);
        leaveRequest.setUpdatedAt(LocalDateTime.now());
        LeaveRequest updated = leaveRequestRepository.save(leaveRequest);
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
        return mapToDto(created);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<LeaveRequestResponseDto> getAllLeaveRequests(int page, int size, String status) {
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<LeaveRequest> leavePage;

        if (status != null && !status.isBlank()) {
            leavePage = leaveRequestRepository.findByStatusOrderByCreatedAtDesc(status, pageRequest);
        } else {
            leavePage = leaveRequestRepository.findAll(pageRequest);
        }

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
                .createdAt(leaveRequest.getCreatedAt())
                .build();
    }
}
