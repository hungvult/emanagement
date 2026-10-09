package com.emanagement.backend.modules.bulkimport;

import java.util.Collection;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BulkImportJobRepository extends JpaRepository<BulkImportJob, Long> {

    boolean existsByStatusIn(Collection<BulkImportStatus> statuses);

    Optional<BulkImportJob> findFirstByStatusInOrderByCreatedAtDesc(Collection<BulkImportStatus> statuses);

    Page<BulkImportJob> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
