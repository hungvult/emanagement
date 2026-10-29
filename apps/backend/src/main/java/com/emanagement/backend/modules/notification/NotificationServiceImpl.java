package com.emanagement.backend.modules.notification;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.notification.dto.NotificationResponseDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final com.emanagement.backend.modules.employee.UserRepository userRepository;

    private java.time.LocalDateTime now() {
        return java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    @Override
    @Transactional
    public void notifyAdmins(NotificationType type, String title, String message, Long referenceId, String targetUrl) {
        for (User admin : userRepository.findActiveAdmins()) {
            save(admin, type, title, message, referenceId, targetUrl, null, null);
        }
    }

    @Override
    @Transactional
    public void notifyOnce(User user, NotificationType type, String title, String message, Long referenceId,
                           String targetUrl, String key, java.time.LocalDateTime expiresAt) {
        // Serialize delivery for this recipient; the key survives deletion from the inbox.
        User recipient = userRepository.lockForNotification(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người nhận thông báo"));
        if (!notificationRepository.existsByDeduplicationKey(key)) {
            save(recipient, type, title, message, referenceId, targetUrl, key, expiresAt);
        }
    }

    @Override
    @Transactional
    public void notifyAdminsOnce(NotificationType type, String title, String message, Long referenceId,
                                 String targetUrl, String key, java.time.LocalDateTime expiresAt) {
        for (User admin : userRepository.findActiveAdmins()) {
            notifyOnce(admin, type, title, message, referenceId, targetUrl, key + ":" + admin.getId(), expiresAt);
        }
    }

    @Override
    @Transactional
    public void dismiss(java.util.Collection<String> keys) {
        if (!keys.isEmpty()) notificationRepository.dismissKeys(keys);
    }

    @Override
    @Transactional
    public void dismissUnassignedReminders(java.util.Collection<Long> assignmentIds) {
        notificationRepository.dismissUnassigned(List.of(NotificationType.SHIFT_REMINDER,
                NotificationType.MISSING_CHECK_IN, NotificationType.MISSING_CHECK_OUT),
                assignmentIds.isEmpty() ? List.of(-1L) : assignmentIds);
    }

    private void save(User user, NotificationType type, String title, String message, Long referenceId,
                      String targetUrl, String key, java.time.LocalDateTime expiresAt) {
        notificationRepository.save(Notification.builder().user(user).type(type).title(title).message(message)
                .referenceId(referenceId).targetUrl(targetUrl).deduplicationKey(key).expiresAt(expiresAt)
                .createdAt(now()).build());
    }

    @Override
    @Transactional
    public void notifyUser(User user, NotificationType type, String title, String message, Long referenceId) {
        String target = switch (type) {
            case LEAVE_REQUESTED, LEAVE_APPROVED, LEAVE_REJECTED -> "/leave-requests?requestId=" + referenceId;
            case ATTENDANCE_ADJUSTED -> "/attendance?recordId=" + referenceId;
            case MISSING_CHECK_IN, MISSING_CHECK_OUT -> "/attendance";
            case FACE_REGISTRATION_REQUIRED -> "/profile";
            default -> "/my-schedule";
        };
        save(user, type, title, message, referenceId, target, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<NotificationResponseDto> getMyNotifications(Long userId, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        return PageResponse.from(
                notificationRepository
                        .findVisible(userId, now(), PageRequest.of(Math.max(page, 0), safeSize))
                        .map(this::mapToDto));
    }

    @Override
    @Transactional(readOnly = true)
    public long countUnread(Long userId) {
        return notificationRepository.countUnread(userId, now());
    }

    @Override
    @Transactional
    public void markAsRead(Long userId, Long notificationId) {
        Notification n = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông báo với ID: " + notificationId));
        n.setIsRead(true);
        notificationRepository.save(n);
    }

    @Override
    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllAsRead(userId);
    }

    @Override
    @Transactional
    public void deleteNotification(Long userId, Long notificationId) {
        Notification n = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông báo với ID: " + notificationId));
        n.setDeleted(true);
        notificationRepository.save(n);
    }

    private NotificationResponseDto mapToDto(Notification n) {
        return NotificationResponseDto.builder()
                .id(n.getId())
                .type(n.getType())
                .title(n.getTitle())
                .message(n.getMessage())
                .referenceId(n.getReferenceId())
                .targetUrl(n.getTargetUrl() != null ? n.getTargetUrl() : "/my-schedule")
                .read(Boolean.TRUE.equals(n.getIsRead()))
                .createdAt(n.getCreatedAt())
                .build();
    }
}
