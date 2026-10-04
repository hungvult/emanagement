package com.emanagement.backend.modules.shift.dto;

import java.time.LocalDate;
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
@Schema(description = "Yêu cầu chỉnh sửa ca làm việc")
public class ShiftUpdateDto {

    @NotBlank(message = "Tên ca làm việc không được để trống")
    @Size(min = 2, max = 100, message = "Tên ca làm việc từ 2 đến 100 ký tự")
    private String name;

    @NotNull(message = "Giờ bắt đầu không được để trống")
    private LocalTime startTime;

    @NotNull(message = "Giờ kết thúc không được để trống")
    private LocalTime endTime;

    @Min(value = 0, message = "Thời gian gia hạn đi muộn tối thiểu là 0 phút")
    @Max(value = 120, message = "Thời gian gia hạn đi muộn tối đa là 120 phút")
    private Integer gracePeriodMinutes = 15;

    @Schema(description = "Ngày bắt đầu áp dụng giờ mới cho các lịch đã phân. Mặc định = ngày mai. Không được nhỏ hơn ngày mai.")
    private LocalDate effectiveFrom;

    @Schema(description = "Đặt true để kích hoạt lại một ca đã ngừng sử dụng")
    private Boolean active;
}
