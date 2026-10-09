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

    @Override
    @Transactional
    public void notifyUser(User user, NotificationType type, String title, String message, Long referenceId) {
        Notification notification = Notification.builder()
                .user(user)
                .type(type)
                .title(title)
                .message(message)
                .referenceId(referenceId)
                .build();
        notificationRepository.save(notification);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<NotificationResponseDto> getMyNotifications(Long userId, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        return PageResponse.from(
                notificationRepository
                        .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(Math.max(page, 0), safeSize))
                        .map(this::mapToDto));
    }

    @Override
    @Transactional(readOnly = true)
    public long countUnread(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
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
        notificationRepository.delete(n);
    }

    private NotificationResponseDto mapToDto(Notification n) {
        return NotificationResponseDto.builder()
                .id(n.getId())
                .type(n.getType())
                .title(n.getTitle())
                .message(n.getMessage())
                .referenceId(n.getReferenceId())
                .read(Boolean.TRUE.equals(n.getIsRead()))
                .createdAt(n.getCreatedAt())
                .build();
    }
}
