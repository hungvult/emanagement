package com.emanagement.backend.modules.notification;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import com.emanagement.backend.modules.bulkimport.*;
import com.emanagement.backend.modules.employee.User;

class ImportNotificationServiceTest {
    @Test
    void onlyTerminalJobsNotifyTheirCreatorWithALinkToTheResult() {
        NotificationService service = mock(NotificationService.class);
        ImportNotificationService imports = new ImportNotificationService(service);
        User creator = User.builder().id(1L).build();
        BulkImportJob job = BulkImportJob.builder().id(9L).createdBy(creator).status(BulkImportStatus.PROCESSING).build();
        imports.notifyResult(job);
        verifyNoInteractions(service);
        job.setStatus(BulkImportStatus.COMPLETED);
        job.setSuccessCount(10); job.setFailedCount(2);
        imports.notifyResult(job);
        verify(service).notifyOnce(eq(creator), eq(NotificationType.IMPORT_COMPLETED), any(), contains("10 thành công, 2 lỗi"),
                eq(9L), eq("/employees?importJobId=9"), eq("import:9"), isNull());
        job.setStatus(BulkImportStatus.FAILED);
        imports.notifyResult(job);
        verify(service).notifyOnce(eq(creator), eq(NotificationType.IMPORT_FAILED), any(), any(), eq(9L), any(), any(), isNull());
    }
}
