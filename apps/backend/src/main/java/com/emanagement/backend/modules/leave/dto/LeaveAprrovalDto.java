package com.emanagement.backend.modules.leave.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LeaveAprrovalDto {
    @NotNull(message = "ID nguoi duyet khong duoc de trong")
    private Long approvedByUserId;

    @NotBlank(message = "Trang thai duyet khong duoc de trong (APRROVED hoac REJECTED)")
    private String status;
}
