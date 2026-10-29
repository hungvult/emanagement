package com.emanagement.backend.modules.notification;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class RecognitionHealthMonitorTest {
    @Test
    void alertsOnlyAfterThreeFailuresAndOncePerOutageThenReportsRecovery() {
        NotificationService notifications = mock(NotificationService.class);
        RecognitionHealthMonitor monitor = new RecognitionHealthMonitor(notifications);
        LocalDateTime now = LocalDateTime.of(2026, 10, 29, 10, 0);
        monitor.update(false, now);
        monitor.update(false, now.plusMinutes(1));
        verifyNoInteractions(notifications);
        monitor.update(false, now.plusMinutes(2));
        monitor.update(false, now.plusMinutes(3));
        verify(notifications, times(1)).notifyAdminsOnce(eq(NotificationType.SERVICE_UNAVAILABLE), any(), any(), isNull(), any(), any(), isNull());
        monitor.update(true, now.plusMinutes(4));
        monitor.update(true, now.plusMinutes(5));
        verify(notifications, times(1)).notifyAdminsOnce(eq(NotificationType.SERVICE_RECOVERED), any(), any(), isNull(), any(), any(), isNull());
    }
}
