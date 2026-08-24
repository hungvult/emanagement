package com.emanagement.backend.modules.employee.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Thông tin chi tiết của nhân viên trong hệ thống")
public class EmployeeResponseDto {

    @Schema(description = "ID cơ sở dữ liệu của nhân viên", example = "1")
    private Long id;

    @Schema(description = "Mã nhân viên tự sinh chuẩn doanh nghiệp", example = "EMP260001")
    private String employeeCode;

    @Schema(description = "Họ và tên nhân viên", example = "Nguyễn Văn C")
    private String fullName;

    @Schema(description = "Email liên lạc chính thức", example = "nguyenvanc@gmail.com")
    private String email;

    @Schema(description = "Số điện thoại liên lạc", example = "0912345678")
    private String phone;

    @Schema(description = "Đường dẫn ảnh đại diện", example = "minio://avatars/emp260001.jpg")
    private String avatarUrl;

    @Schema(description = "Trạng thái hoạt động của nhân viên", example = "ACTIVE")
    private String status;

    @Schema(description = "Danh sách quyền hạn trong hệ thống", example = "[\"ROLE_USER\"]")
    private Set<String> roles;

    @Schema(description = "Đã hoàn tất đăng ký dữ liệu khuôn mặt eKYC hay chưa", example = "true")
    private boolean hasRegisteredFace;

    @Schema(description = "Thời điểm tạo hồ sơ nhân viên", example = "2026-08-24T12:00:00")
    private LocalDateTime createdAt;
}
