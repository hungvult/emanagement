package com.emanagement.backend.modules.kiosk;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "kiosks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Kiosk {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kiosk_code", nullable = false, unique = true, length = 50)
    private String kioskCode;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "device_token", nullable = false, unique = true, length = 255)
    private String deviceToken;

    @Column(length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
