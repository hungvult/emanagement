package com.emanagement.backend.modules.leave;

import java.util.List;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.leave.dto.LeaveAprrovalDto;
import com.emanagement.backend.modules.leave.dto.LeaveRequestCreateDto;
import com.emanagement.backend.modules.leave.dto.LeaveRequestResponseDto;

public interface LeaveRequestService {
    LeaveRequestResponseDto createLeaveRequest(LeaveRequestCreateDto dto);

    List<LeaveRequestResponseDto> getMyLeaveRequests(Long userId);

    PageResponse<LeaveRequestResponseDto> getAllLeaveRequests(int page, int size, String status);

    LeaveRequestResponseDto approveLeaveRequest(Long id, LeaveAprrovalDto dto);
}
