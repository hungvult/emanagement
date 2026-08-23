package com.emanagement.backend.modules.face;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FaceDataRepository extends JpaRepository<FaceData, Long> {
    List<FaceData> findByUserId(Long userId);

    void deleteByUserId(Long userId);
}
