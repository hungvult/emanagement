package com.emanagement.backend.modules.notification;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    @Query("select n from Notification n where n.user.id = :userId and n.deleted = false "
            + "and (n.expiresAt is null or n.expiresAt > :now) order by n.createdAt desc, n.id desc")
    Page<Notification> findVisible(@Param("userId") Long userId, @Param("now") java.time.LocalDateTime now, Pageable pageable);

    @Query("select count(n) from Notification n where n.user.id = :userId and n.isRead = false and n.deleted = false "
            + "and (n.expiresAt is null or n.expiresAt > :now)")
    long countUnread(@Param("userId") Long userId, @Param("now") java.time.LocalDateTime now);

    boolean existsByDeduplicationKey(String key);

    @Modifying
    @Query("update Notification n set n.deleted = true where n.deleted = false and n.type in :types "
            + "and n.referenceId not in :assignmentIds")
    int dismissUnassigned(@Param("types") java.util.Collection<NotificationType> types,
                          @Param("assignmentIds") java.util.Collection<Long> assignmentIds);

    @Modifying
    @Query("update Notification n set n.deleted = true where n.deduplicationKey in :keys")
    int dismissKeys(@Param("keys") java.util.Collection<String> keys);

    Optional<Notification> findByIdAndUserId(Long id, Long userId);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
    int markAllAsRead(@Param("userId") Long userId);
}
