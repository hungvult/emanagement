package com.emanagement.backend.modules.alert.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ResolveAlertRequestDto {

    @NotNull(message = "ID người xử lý không được để trống")
    private Long resolvedByUserId;
}
