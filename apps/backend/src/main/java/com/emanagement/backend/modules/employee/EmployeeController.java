package com.emanagement.backend.modules.employee;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.employee.dto.EmployeeCreateDto;
import com.emanagement.backend.modules.employee.dto.EmployeeResponseDto;
import com.emanagement.backend.modules.employee.dto.EmployeeUpdateDto;
import com.emanagement.backend.modules.employee.dto.LiveEkycEnrollDto;
import com.emanagement.backend.modules.employee.dto.LiveEkycEnrollResponseDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/employees")
@RequiredArgsConstructor
public class EmployeeController {
    private final EmployeeServiceImpl employeeServiceImpl;

    @PostMapping
    public ResponseEntity<ApiResponse<EmployeeResponseDto>> createEmployee(@Valid @RequestBody EmployeeCreateDto dto) {
        EmployeeResponseDto response = employeeServiceImpl.createEmployee(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Them nhan vien moi thanh cong", response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<EmployeeResponseDto>>> getAllEmloyees(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<EmployeeResponseDto> responsee = employeeServiceImpl.getAllEmployees(page, size);
        return ResponseEntity.ok(ApiResponse.success(responsee));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EmployeeResponseDto>> getEmployeeById(@PathVariable Long id) {
        EmployeeResponseDto response = employeeServiceImpl.getEmployeeById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EmployeeResponseDto>> updateEmployee(@PathVariable Long id,
            @Valid @RequestBody EmployeeUpdateDto dto) {
        EmployeeResponseDto response = employeeServiceImpl.updateEmployee(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Cap nhat nhan vien thanh cong", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteEmployee(@PathVariable Long id) {
        employeeServiceImpl.deleteEmployee(id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT)
                .body(ApiResponse.success("Vo hieu hoa tai khoan nhan vien thanh cong", null));
    }

    @PostMapping("/ekyc-enroll")
    public ResponseEntity<ApiResponse<LiveEkycEnrollResponseDto>> enrollEkycLive(
            @Valid @RequestBody LiveEkycEnrollDto dto) {
        LiveEkycEnrollResponseDto response = employeeServiceImpl.enrollEkycLive(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Dang ky du lieu khoan mat eKyc thanh cong", response));
    }
}
