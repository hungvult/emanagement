package com.emanagement.backend.modules.shift.dto;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

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
@Schema(description = "Phân ca hàng loạt: nhiều nhân viên x một khoảng ngày x các thứ trong tuần")
public class BulkAssignDto {

    @Schema(description = "Danh sách nhân viên. Bỏ trống = tất cả nhân viên đang ACTIVE")
    @Size(max = 500, message = "Tối đa 500 nhân viên mỗi lần")
    private List<Long> userIds;

    @NotNull(message = "ID ca làm việc không được để trống")
    private Long shiftId;

    @NotNull(message = "Ngày bắt đầu không được để trống")
    private LocalDate startDate;

    @NotNull(message = "Ngày kết thúc không được để trống")
    private LocalDate endDate;

    @Schema(description = "Các thứ áp dụng (MONDAY..SUNDAY). Bỏ trống = Thứ 2 → Thứ 6")
    private Set<DayOfWeek> daysOfWeek;

    @Schema(description = "false = giữ nguyên ngày đã có ca khác; true = ghi đè ca khác")
    private Boolean overwrite = false;

    @Schema(description = "true = chỉ xem trước kết quả, không ghi dữ liệu")
    private Boolean dryRun = false;
}
