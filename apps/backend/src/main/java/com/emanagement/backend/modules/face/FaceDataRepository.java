package com.emanagement.backend.modules.face;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FaceDataRepository extends JpaRepository<FaceData, Long> {
    @org.springframework.data.jpa.repository.Query("select distinct f.user.id from FaceData f")
    List<Long> findRegisteredUserIds();
    List<FaceData> findByUserId(Long userId);

    void deleteByUserId(Long userId);
}
