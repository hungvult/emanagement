package com.emanagement.backend.modules.leave;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

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

@Service
@RequiredArgsConstructor
public class LeaveRequestServiceImpl implements LeaveRequestService {
    private final LeaveRequestRepository leaveRequestRepository;
    private final UserRepository userRepository;

    @Override
    public LeaveRequestResponseDto approveLeaveRequest(Long id, LeaveAprrovalDto dto) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay don xin nghi phep voi ID: " + id));
        User manager = userRepository.findById(dto.getApprovedByUserId())
                .orElseThrow(
                        () -> new ResourceNotFoundException(
                                "Khong tim thay quan ly voi ID: " + dto.getApprovedByUserId()));

        leaveRequest.setStatus(dto.getStatus());
        leaveRequest.setApprovedBy(manager);
        leaveRequest.setUpdatedAt(LocalDateTime.now());

        LeaveRequest updated = leaveRequestRepository.save(leaveRequest);
        return mapToDto(updated);
    }

    @Override
    @Transactional
    public LeaveRequestResponseDto createLeaveRequest(LeaveRequestCreateDto dto) {
        User user = userRepository.findById(dto.getUserId()).orElseThrow(
                () -> new ResourceNotFoundException("Khong tim thay nhan vien voi ID: " + dto.getUserId()));

        if (dto.getStartDate().isAfter(dto.getEndDate())) {
            throw new BusinessException("Ngay ket thuc nghi khong duoc nho hon ngay bat dau nghi");
        }

        LeaveRequest leaveRequest = new LeaveRequest();
        leaveRequest.setUser(user);
        leaveRequest.setStartDate(dto.getStartDate());
        leaveRequest.setEndDate(dto.getEndDate());
        leaveRequest.setReason(dto.getReason());
        leaveRequest.setStatus("PENDING");

        LeaveRequest created = leaveRequestRepository.save(leaveRequest);
        return mapToDto(created);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<LeaveRequestResponseDto> getAllLeaveRequests(int page, int size, String status) {
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<LeaveRequest> pageResult;
        if (status != null && !status.isBlank()) {
            pageResult = leaveRequestRepository.findByStatusOrderByCreatedAtDesc(status, pageRequest);
        } else {
            pageResult = leaveRequestRepository.findAll(pageRequest);
        }
        return PageResponse.from(pageResult.map(this::mapToDto));
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
