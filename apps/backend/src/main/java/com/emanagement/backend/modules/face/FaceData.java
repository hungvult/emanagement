package com.emanagement.backend.modules.face;

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
@Table(name = "face_data")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FaceData {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "face_vector", nullable = false, columnDefinition = "TEXT")
    private String faceVector;

    @Column(name = "front_image_url", length = 500)
    private String frontImageUrl;

    @Column(name = "blink_image_url", length = 500)
    private String blinkImageUrl;

    @Column(name = "left_image_url", length = 500)
    private String leftImageUrl;

    @Column(name = "right_image_url", length = 500)
    private String rightImageUrl;

    @Column(name = "up_image_url", length = 500)
    private String upImageUrl;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
