package com.emanagement.backend.modules.bulkimport.dto;

import java.time.OffsetDateTime;

import com.emanagement.backend.modules.bulkimport.BulkImportStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkImportJobDto {
    private Long id;
    private String fileName;
    private Long fileSize;
    private BulkImportStatus status;
    private Integer totalRecords;
    private Integer processedRecords;
    private Integer successCount;
    private Integer failedCount;
    private Double progressPercentage;
    private String errorLog;
    private String createdByUserName;
    private OffsetDateTime startedAt;
    private OffsetDateTime finishedAt;
    private OffsetDateTime createdAt;
}
