package com.emanagement.backend.modules.bulkimport.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import com.emanagement.backend.modules.bulkimport.dto.BulkImportJobDto;

public interface BulkImportService {

    /**
     * Submit a bulk import job.
     * Throws BusinessException (HTTP 409) if another job is currently running.
     */
    BulkImportJobDto submitImportJob(MultipartFile file, Long currentUserId);

    /**
     * Get details and live progress of a job.
     */
    BulkImportJobDto getJobById(Long jobId);

    /**
     * Get the currently active job (if any) to reconnect on page reload.
     */
    BulkImportJobDto getActiveJob();

    /**
     * List historical import jobs.
     */
    Page<BulkImportJobDto> listJobs(Pageable pageable);

    /**
     * Generate template CSV for employee import.
     */
    byte[] generateTemplateCsv();
}
