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

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/employees")
@RequiredArgsConstructor
@Tag(name = "Quản lý Nhân viên", description = "Các API quản lý thông tin nhân viên và đăng ký dữ liệu khuôn mặt eKYC")
public class EmployeeController {
    private final EmployeeService employeeService;

    @PostMapping
    @Operation(summary = "Thêm nhân viên mới", description = "Tạo mới một nhân viên trong hệ thống với mật khẩu được mã hóa an toàn")
    public ResponseEntity<ApiResponse<EmployeeResponseDto>> createEmployee(@Valid @RequestBody EmployeeCreateDto dto) {
        EmployeeResponseDto response = employeeService.createEmployee(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Thêm nhân viên mới thành công", response));
    }

    @GetMapping
    @Operation(summary = "Lấy danh sách nhân viên", description = "Lấy danh sách tất cả nhân viên có hỗ trợ phân trang")
    public ResponseEntity<ApiResponse<PageResponse<EmployeeResponseDto>>> getAllEmployees(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PageResponse<EmployeeResponseDto> response = employeeService.getAllEmployees(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết nhân viên", description = "Lấy thông tin chi tiết của nhân viên theo ID")
    public ResponseEntity<ApiResponse<EmployeeResponseDto>> getEmployeeById(@PathVariable Long id) {
        EmployeeResponseDto response = employeeService.getEmployeeById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Cập nhật nhân viên", description = "Cập nhật thông tin của nhân viên theo ID")
    public ResponseEntity<ApiResponse<EmployeeResponseDto>> updateEmployee(@PathVariable Long id,
            @Valid @RequestBody EmployeeUpdateDto dto) {
        EmployeeResponseDto response = employeeService.updateEmployee(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thông tin nhân viên thành công", response));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Vô hiệu hóa nhân viên", description = "Chuyển trạng thái nhân viên sang INACTIVE")
    public ResponseEntity<ApiResponse<Void>> deleteEmployee(@PathVariable Long id) {
        employeeService.deleteEmployee(id);
        return ResponseEntity.ok(ApiResponse.success("Vô hiệu hóa tài khoản nhân viên thành công", null));
    }

    @PostMapping("/ekyc-enroll")
    @Operation(summary = "Đăng ký khuôn mặt eKYC Live", description = "Tiếp nhận các frame ảnh Base64 live từ camera và trích xuất vector khuôn mặt")
    public ResponseEntity<ApiResponse<LiveEkycEnrollResponseDto>> enrollEkycLive(
            @Valid @RequestBody LiveEkycEnrollDto dto) {
        LiveEkycEnrollResponseDto response = employeeService.enrollEkycLive(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đăng ký dữ liệu khuôn mặt eKYC thành công", response));
    }
}
