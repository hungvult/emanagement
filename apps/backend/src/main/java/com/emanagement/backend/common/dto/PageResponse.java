package com.emanagement.backend.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "Đối tượng phân trang dữ liệu chuẩn")
public class PageResponse<T> {

    @Schema(description = "Danh sách bản ghi của trang hiện tại")
    private List<T> content;

    @Schema(description = "Số thứ tự trang hiện tại (bắt đầu từ 0)", example = "0")
    private int pageNumber;

    @Schema(description = "Kích thước số lượng bản ghi mỗi trang", example = "10")
    private int pageSize;

    @Schema(description = "Tổng số lượng bản ghi có trên toàn hệ thống", example = "42")
    private long totalElement;

    @Schema(description = "Tổng số lượng trang", example = "5")
    private long totalPages;

    @Schema(description = "Có phải trang cuối cùng hay không", example = "false")
    private boolean last;

    public static <T> PageResponse<T> from(Page<T> page) {
        return PageResponse.<T>builder()
                .content(page.getContent())
                .pageNumber(page.getNumber())
                .pageSize(page.getSize())
                .totalElement(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
