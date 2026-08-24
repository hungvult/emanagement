package com.emanagement.backend.modules.shift.dto;

import java.time.LocalTime;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
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
@Schema(description = "Yêu cầu tạo mới ca làm việc (Mã ca SHIFT-XXX tự sinh 100%)")
public class ShiftCreateDto {

    @NotBlank(message = "Tên ca làm việc không được để trống")
    @Size(min = 2, max = 150, message = "Tên ca làm việc từ 2 đến 150 ký tự")
    @Schema(description = "Tên ca làm việc", example = "Ca Hành Chính")
    private String name;

    @NotNull(message = "Giờ bắt đầu không được để trống")
    @Schema(description = "Giờ bắt đầu ca", example = "08:00:00")
    private LocalTime startTime;

    @NotNull(message = "Giờ kết thúc không được để trống")
    @Schema(description = "Giờ kết thúc ca", example = "17:30:00")
    private LocalTime endTime;

    @Min(value = 0, message = "Thời gian gia hạn đi muộn tối thiểu là 0 phút")
    @Max(value = 120, message = "Thời gian gia hạn đi muộn tối đa là 120 phút")
    @Schema(description = "Số phút được phép đi trễ", example = "15")
    private Integer gracePeriodMinutes = 15;
}
