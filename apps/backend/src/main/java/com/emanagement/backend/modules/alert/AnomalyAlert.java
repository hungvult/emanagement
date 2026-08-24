package com.emanagement.backend.modules.alert;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.emanagement.backend.modules.employee.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "anomaly_alerts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnomalyAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "alert_type", nullable = false, length = 50)
    private String alertType;

    @Column(name = "alert_date", nullable = false)
    private LocalDate alertDate;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_resolved")
    @Builder.Default
    private Boolean isResolved = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolve_by")
    private User resolvedBy;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
