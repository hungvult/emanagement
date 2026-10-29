package com.emanagement.backend.modules.notification;

import java.util.List;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.notification.dto.NotificationResponseDto;

public interface NotificationService {
    void notifyUser(User user, NotificationType type, String title, String message, Long referenceId);
    void notifyAdmins(NotificationType type, String title, String message, Long referenceId, String targetUrl);
    void notifyOnce(User user, NotificationType type, String title, String message, Long referenceId,
                    String targetUrl, String key, java.time.LocalDateTime expiresAt);
    void notifyAdminsOnce(NotificationType type, String title, String message, Long referenceId,
                          String targetUrl, String key, java.time.LocalDateTime expiresAt);
    void dismiss(java.util.Collection<String> keys);
    void dismissUnassignedReminders(java.util.Collection<Long> assignmentIds);
    PageResponse<NotificationResponseDto> getMyNotifications(Long userId, int page, int size);
    long countUnread(Long userId);
    
    void markAsRead(Long userId, Long notificationId);
    void markAllAsRead(Long userId);
    void deleteNotification(Long userId, Long notificationId);
}
