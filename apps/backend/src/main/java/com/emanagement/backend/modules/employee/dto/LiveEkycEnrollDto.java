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

    @NotEmpty(message = "Vector khuôn mặt không được để trống")
    private List<Double> faceVector;
}
