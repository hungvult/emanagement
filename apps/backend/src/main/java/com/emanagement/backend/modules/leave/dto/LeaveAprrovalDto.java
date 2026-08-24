package com.emanagement.backend.modules.leave.dto;

import com.emanagement.backend.common.validation.ValidationPatterns;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LeaveAprrovalDto {

    @NotNull(message = "ID người phê duyệt không được để trống")
    private Long approvedByUserId;

    @NotBlank(message = "Trạng thái duyệt không được để trống (APPROVED hoặc REJECTED)")
    @Pattern(regexp = ValidationPatterns.LEAVE_STATUS_REGEX, message = "Trạng thái phê duyệt chỉ chấp nhận APPROVED hoặc REJECTED")
    private String status;
}
