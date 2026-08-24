package com.emanagement.backend.modules.employee.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LiveEkycEnrollDto {

    @NotNull(message = "ID nhân viên không được để trống")
    private Long userId;

    @NotEmpty(message = "Danh sách ảnh khuôn mặt không được để trống")
    @Size(min = 1, max = 10, message = "Danh sách quét khuôn mặt phải từ 1 đến 10 khung hình")
    private List<String> faceImagesBase64;
}
