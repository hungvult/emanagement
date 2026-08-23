package com.emanagement.backend.modules.employee;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.employee.dto.EmployeeCreateDto;
import com.emanagement.backend.modules.employee.dto.EmployeeResponseDto;
import com.emanagement.backend.modules.employee.dto.EmployeeUpdateDto;
import com.emanagement.backend.modules.employee.dto.LiveEkycEnrollDto;
import com.emanagement.backend.modules.employee.dto.LiveEkycEnrollResponseDto;

public interface EmployeeService {
    EmployeeResponseDto createEmployee(EmployeeCreateDto dto);

    EmployeeResponseDto updateEmployee(Long id, EmployeeUpdateDto dto);

    EmployeeResponseDto getEmployeeById(Long id);

    PageResponse<EmployeeResponseDto> getAllEmployees(int page, int size);

    void deleteEmployee(Long id);

    LiveEkycEnrollResponseDto enrollEkycLive(LiveEkycEnrollDto dto);
}
