package com.emanagement.backend.modules.notification;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.modules.employee.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class NotificationIntegrationTest {
    @Autowired NotificationService service;
    @Autowired UserRepository users;
    @Autowired NotificationRepository notifications;
    private User user;

    @BeforeEach
    void setup() {
        user = users.save(User.builder().employeeCode("TEST" + UUID.randomUUID()).fullName("Test recipient")
                .passwordHash("unused-test-password").status("ACTIVE").build());
    }

    @Test
    void onceOnlyDeliverySurvivesDeletionAndSupportsReadAll() {
        service.notifyOnce(user, NotificationType.MISSING_CHECK_IN, "Reminder", "Check in", 1L,
                "/attendance", "dedup-test", null);
        service.notifyOnce(user, NotificationType.MISSING_CHECK_IN, "Reminder", "Check in", 1L,
                "/attendance", "dedup-test", null);
        assertEquals(1, service.countUnread(user.getId()));
        var page = service.getMyNotifications(user.getId(), 0, 10);
        assertEquals(1, page.getContent().size());
        assertEquals("/attendance", page.getContent().getFirst().getTargetUrl());
        service.markAllAsRead(user.getId());
        assertEquals(0, service.countUnread(user.getId()));
        service.deleteNotification(user.getId(), page.getContent().getFirst().getId());
        service.notifyOnce(user, NotificationType.MISSING_CHECK_IN, "Reminder", "Check in", 1L,
                "/attendance", "dedup-test", null);
        assertTrue(service.getMyNotifications(user.getId(), 0, 10).getContent().isEmpty());
        assertTrue(notifications.existsByDeduplicationKey("dedup-test"));
    }

    @Test
    void expiredAndDismissedRemindersDoNotAppearOrCountAsUnread() {
        service.notifyOnce(user, NotificationType.SHIFT_REMINDER, "Expired", "Message", 1L, "/my-schedule",
                "expired-test", LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).minusMinutes(1));
        service.notifyOnce(user, NotificationType.MISSING_CHECK_OUT, "Active", "Message", 2L, "/attendance",
                "resolved-test", null);
        assertEquals(1, service.countUnread(user.getId()));
        service.dismiss(java.util.List.of("resolved-test"));
        assertEquals(0, service.countUnread(user.getId()));
        assertTrue(service.getMyNotifications(user.getId(), 0, 10).getContent().isEmpty());
    }

    @Test
    void recipientCannotReadOrDeleteAnotherPersonsNotification() {
        service.notifyUser(user, NotificationType.SHIFT_CHANGED, "Changed", "Message", 3L);
        Long id = service.getMyNotifications(user.getId(), 0, 10).getContent().getFirst().getId();
        Long other = user.getId() + 1000000;
        assertThrows(ResourceNotFoundException.class, () -> service.markAsRead(other, id));
        assertThrows(ResourceNotFoundException.class, () -> service.deleteNotification(other, id));
    }
}
