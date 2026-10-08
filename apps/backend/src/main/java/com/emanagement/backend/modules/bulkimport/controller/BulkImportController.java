package com.emanagement.backend.modules.bulkimport.controller;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.modules.bulkimport.dto.BulkImportJobDto;
import com.emanagement.backend.modules.bulkimport.service.BulkImportService;
import com.emanagement.backend.security.UserPrincipal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/employees/bulk-import")
@RequiredArgsConstructor
@Tag(name = "Nhập dữ liệu nhân viên hàng loạt", description = "Các API tải lên tệp ZIP, trích xuất vector khuôn mặt và nạp dữ liệu nhân viên quy mô lớn")
public class BulkImportController {

    private final BulkImportService bulkImportService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @Operation(summary = "Tải lên tệp ZIP và bắt đầu nạp nhân viên hàng loạt (Chỉ Admin)", description = "Tiếp nhận tệp ZIP chứa CSV và ảnh chân dung, chạy bất đồng bộ qua AI Service")
    public ResponseEntity<ApiResponse<BulkImportJobDto>> submitImportJob(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserPrincipal principal) {
        Long userId = principal != null ? principal.getId() : null;
        BulkImportJobDto result = bulkImportService.submitImportJob(file, userId);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success("Đã tiếp nhận tệp ZIP và bắt đầu xử lý nhập hàng loạt", result));
    }

    @GetMapping("/jobs/active")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @Operation(summary = "Lấy tiến trình nhập hàng loạt đang chạy (Chỉ Admin)", description = "Hỗ trợ kết nối lại khi người dùng reload trang hoặc đổi thiết bị")
    public ResponseEntity<ApiResponse<BulkImportJobDto>> getActiveJob() {
        BulkImportJobDto activeJob = bulkImportService.getActiveJob();
        return ResponseEntity.ok(ApiResponse.success(activeJob));
    }

    @GetMapping("/jobs/{id}")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @Operation(summary = "Tra cứu chi tiết và tiến độ tiến trình (Chỉ Admin)", description = "Lấy trạng thái, phần trăm hoàn tất, số bản ghi thành công/thất bại theo ID")
    public ResponseEntity<ApiResponse<BulkImportJobDto>> getJobById(@PathVariable Long id) {
        BulkImportJobDto job = bulkImportService.getJobById(id);
        return ResponseEntity.ok(ApiResponse.success(job));
    }

    @GetMapping("/jobs")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @Operation(summary = "Danh sách lịch sử các đợt nhập hàng loạt (Chỉ Admin)", description = "Xem danh sách các công việc nhập dữ liệu đã thực hiện")
    public ResponseEntity<ApiResponse<Page<BulkImportJobDto>>> listJobs(@PageableDefault(size = 10) Pageable pageable) {
        Page<BulkImportJobDto> page = bulkImportService.listJobs(pageable);
        return ResponseEntity.ok(ApiResponse.success(page));
    }

    @GetMapping("/template")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @Operation(summary = "Tải tệp CSV mẫu (Chỉ Admin)", description = "Tải mẫu tệp CSV để chuẩn bị dữ liệu nhập nhân viên và ảnh chân dung")
    public ResponseEntity<byte[]> downloadTemplate() {
        byte[] csvBytes = bulkImportService.generateTemplateCsv();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"employee_import_template.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csvBytes);
    }
}
