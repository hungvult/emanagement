package com.emanagement.backend.modules.employee.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LiveEkycEnrollDto {
    @NotNull(message = "ID nhan vien khong duoc de trong")
    private Long userId;

    @NotEmpty(message = "Danh sach khuon mat khong duoc de trong")
    private List<String> faceImagesBase64;
}
