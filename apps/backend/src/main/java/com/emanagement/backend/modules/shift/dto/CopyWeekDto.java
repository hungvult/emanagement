package com.emanagement.backend.modules.shift.dto;

import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
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
@Schema(description = "Sao chép lịch 7 ngày từ tuần nguồn sang tuần đích")
public class CopyWeekDto {

    @NotNull(message = "Ngày đầu tuần nguồn không được để trống")
    private LocalDate sourceWeekStart;

    @NotNull(message = "Ngày đầu tuần đích không được để trống")
    private LocalDate targetWeekStart;

    @Schema(description = "Giới hạn nhân viên cần sao chép. Bỏ trống = tất cả")
    @Size(max = 500, message = "Tối đa 500 nhân viên mỗi lần")
    private List<Long> userIds;

    private Boolean overwrite = false;

    private Boolean dryRun = false;
}
