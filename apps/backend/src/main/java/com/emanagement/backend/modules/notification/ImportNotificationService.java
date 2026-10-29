package com.emanagement.backend.modules.notification;

import org.springframework.stereotype.Service;
import com.emanagement.backend.modules.bulkimport.BulkImportJob;
import com.emanagement.backend.modules.bulkimport.BulkImportStatus;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ImportNotificationService {
    private final NotificationService notifications;

    public void notifyResult(BulkImportJob job) {
        if (job.getCreatedBy() == null) return;
        boolean completed = job.getStatus() == BulkImportStatus.COMPLETED;
        if (!completed && job.getStatus() != BulkImportStatus.FAILED) return;
        notifications.notifyOnce(job.getCreatedBy(),
                completed ? NotificationType.IMPORT_COMPLETED : NotificationType.IMPORT_FAILED,
                completed ? "Import nhân viên đã hoàn tất" : "Import nhân viên thất bại",
                "Tiến trình #" + job.getId() + ": " + job.getSuccessCount() + " thành công, "
                        + job.getFailedCount() + " lỗi. Mở kết quả để xem chi tiết.", job.getId(),
                "/employees?importJobId=" + job.getId(), "import:" + job.getId(), null);
    }
}
