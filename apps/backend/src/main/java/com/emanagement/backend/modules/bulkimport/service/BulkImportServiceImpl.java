package com.emanagement.backend.modules.bulkimport.service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.bulkimport.BulkImportJob;
import com.emanagement.backend.modules.bulkimport.BulkImportJobRepository;
import com.emanagement.backend.modules.bulkimport.BulkImportStatus;
import com.emanagement.backend.modules.bulkimport.dto.BulkImportJobDto;
import com.emanagement.backend.modules.bulkimport.util.ZipSecurityValidator;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.face.AiFaceService;
import com.emanagement.backend.modules.face.dto.AiExtractEmbeddingResponseDto;

import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class BulkImportServiceImpl implements BulkImportService {

    /**
     * Precomputed BCrypt hash (12 rounds) for default password "abc123".
     * Eliminates ~41 minutes of CPU hashing overhead for 10,000 employees.
     */
    public static final String DEFAULT_PASSWORD_HASH = "$2a$12$ZfnbWpbU7ne2hnpUAHcleOCCvPE98a./xcV5irgebX8M0J/ZW3zCq";

    private final BulkImportJobRepository jobRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final AiFaceService aiFaceService;
    private final ZipSecurityValidator zipSecurityValidator;
    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;

    private final ExecutorService executorService = Executors.newFixedThreadPool(6);

    @PreDestroy
    public void destroy() {
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public BulkImportJobDto submitImportJob(MultipartFile file, Long currentUserId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Tệp tải lên không được để trống.");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !originalFilename.toLowerCase().endsWith(".zip")) {
            throw new BusinessException("Hệ thống chỉ chấp nhận tệp định dạng ZIP (.zip).");
        }

        // Mutual exclusion: Đảm bảo chỉ có duy nhất 1 job chạy tại một thời điểm
        boolean hasActiveJob = jobRepository.existsByStatusIn(List.of(
                BulkImportStatus.PENDING,
                BulkImportStatus.VALIDATING,
                BulkImportStatus.PROCESSING));

        if (hasActiveJob) {
            throw new BusinessException("Đang có một tiến trình nhập hàng loạt đang xử lý. Vui lòng đợi hoàn tất trước khi tải tệp mới.");
        }

        User currentUser = currentUserId != null ? userRepository.findById(currentUserId).orElse(null) : null;

        BulkImportJob job = BulkImportJob.builder()
                .fileName(originalFilename)
                .fileSize(file.getSize())
                .status(BulkImportStatus.PENDING)
                .totalRecords(0)
                .processedRecords(0)
                .successCount(0)
                .failedCount(0)
                .createdBy(currentUser)
                .build();

        BulkImportJob savedJob = jobRepository.save(job);
        Long jobId = savedJob.getId();

        // Lưu tệp ZIP vào thư mục sandbox tạm thời
        Path uploadsDir = Paths.get("/tmp/emanagement-bulk-import/uploads");
        Path zipPath = uploadsDir.resolve("job_" + jobId + ".zip");

        try {
            Files.createDirectories(uploadsDir);
            file.transferTo(zipPath);
            zipSecurityValidator.validateZipMagicBytes(zipPath);
        } catch (Exception e) {
            savedJob.setStatus(BulkImportStatus.FAILED);
            savedJob.setErrorLog("Lỗi lưu trữ hoặc kiểm tra tệp ZIP: " + e.getMessage());
            jobRepository.save(savedJob);
            zipSecurityValidator.cleanupSandbox(zipPath);
            throw new BusinessException("Không thể tiếp nhận tệp ZIP: " + e.getMessage());
        }

        // Kích hoạt xử lý bất đồng bộ
        CompletableFuture.runAsync(() -> processJobAsync(jobId, zipPath), executorService);

        return mapToDto(savedJob);
    }

    @Override
    public BulkImportJobDto getJobById(Long jobId) {
        BulkImportJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new BusinessException("Không tìm thấy tiến trình với ID: " + jobId));
        return mapToDto(job);
    }

    @Override
    public BulkImportJobDto getActiveJob() {
        Optional<BulkImportJob> activeJob = jobRepository.findFirstByStatusInOrderByCreatedAtDesc(List.of(
                BulkImportStatus.PENDING,
                BulkImportStatus.VALIDATING,
                BulkImportStatus.PROCESSING));
        return activeJob.map(this::mapToDto).orElse(null);
    }

    @Override
    public Page<BulkImportJobDto> listJobs(Pageable pageable) {
        return jobRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::mapToDto);
    }

    @Override
    public byte[] generateTemplateCsv() {
        String template = "\uFEFFemployee_code,full_name,email,phone,image_path\n"
                + "EMP0001,Nguyễn Văn An,an.nguyen@emanagement.com,0912345671,val/1.jpg\n"
                + "EMP0002,Trần Thị Bình,binh.tran@emanagement.com,0912345672,val/2.jpg\n";
        return template.getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Quy trình xử lý bất đồng bộ 2-Phase Decoupled Pipeline
     */
    private void processJobAsync(Long jobId, Path zipPath) {
        BulkImportJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) return;

        Path targetDir = Paths.get("/tmp/emanagement-bulk-import/extracted/job_" + jobId);

        try {
            job.setStatus(BulkImportStatus.VALIDATING);
            job.setStartedAt(OffsetDateTime.now());
            jobRepository.save(job);

            // 1. Giải nén an toàn với cơ chế bảo vệ Zip Slip và Zip Bomb
            zipSecurityValidator.safeExtract(zipPath, targetDir);

            // 2. Tìm tệp CSV danh sách nhân viên
            Path csvPath = findCsvFile(targetDir);
            if (csvPath == null) {
                job.setStatus(BulkImportStatus.FAILED);
                job.setErrorLog("Không tìm thấy tệp CSV danh sách nhân viên trong tệp ZIP đã tải lên.");
                job.setFinishedAt(OffsetDateTime.now());
                jobRepository.save(job);
                return;
            }

            // 3. Phân tích nội dung tệp CSV
            List<RawEmployeeRow> rows = parseCsvRows(csvPath);
            if (rows.isEmpty()) {
                job.setStatus(BulkImportStatus.FAILED);
                job.setErrorLog("Tệp CSV không chứa bản ghi nhân viên nào hợp lệ.");
                job.setFinishedAt(OffsetDateTime.now());
                jobRepository.save(job);
                return;
            }

            job.setTotalRecords(rows.size());
            job.setStatus(BulkImportStatus.PROCESSING);
            jobRepository.save(job);

            // Lấy role_id cho ROLE_USER
            Long roleId = getRoleId("ROLE_USER");

            // 4. Xử lý Decoupled Pipeline (Phase 1: I/O + AI -> Phase 2: Batch DB Transaction)
            executeDecoupledPipeline(job, rows, targetDir, roleId);

        } catch (Exception e) {
            log.error("Lỗi nghiêm trọng khi thực hiện tiến trình bulk import job #{}: {}", jobId, e.getMessage(), e);
            job.setStatus(BulkImportStatus.FAILED);
            job.setErrorLog("Lỗi hệ thống: " + e.getMessage());
            job.setFinishedAt(OffsetDateTime.now());
            jobRepository.save(job);
        } finally {
            // Dọn dẹp sandbox
            zipSecurityValidator.cleanupSandbox(targetDir);
            try {
                Files.deleteIfExists(zipPath);
            } catch (IOException ignored) {}
        }
    }

    private void executeDecoupledPipeline(BulkImportJob job, List<RawEmployeeRow> rows, Path targetDir, Long roleId) {
        AtomicInteger processedCounter = new AtomicInteger(0);
        AtomicInteger successCounter = new AtomicInteger(0);
        AtomicInteger failedCounter = new AtomicInteger(0);
        List<String> errorList = Collections.synchronizedList(new ArrayList<>());

        ConcurrentLinkedQueue<ValidEmployeeRecord> queue = new ConcurrentLinkedQueue<>();
        final int BATCH_SIZE = 100;
        final Object dbFlushLock = new Object();

        // Chia công việc cho worker pool
        List<CompletableFuture<Void>> futures = new ArrayList<>();
        int chunkSize = Math.max(1, (rows.size() + 5) / 6);

        for (int i = 0; i < rows.size(); i += chunkSize) {
            int start = i;
            int end = Math.min(start + chunkSize, rows.size());
            List<RawEmployeeRow> chunk = rows.subList(start, end);

            CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                for (RawEmployeeRow row : chunk) {
                    processSingleEmployee(row, targetDir, queue, processedCounter, failedCounter, errorList);

                    // Flush batch nếu queue đã đạt kích thước batch
                    if (queue.size() >= BATCH_SIZE) {
                        flushQueueToDb(queue, BATCH_SIZE, roleId, successCounter, dbFlushLock);
                    }
                }
            }, executorService);
            futures.add(future);
        }

        // Chờ tất cả worker hoàn tất Phase 1
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

        // Flush toàn bộ các phần tử còn lại trong queue
        while (!queue.isEmpty()) {
            flushQueueToDb(queue, queue.size(), roleId, successCounter, dbFlushLock);
        }

        // Cập nhật trạng thái hoàn tất cho Job
        job.setStatus(BulkImportStatus.COMPLETED);
        job.setProcessedRecords(processedCounter.get());
        job.setSuccessCount(successCounter.get());
        job.setFailedCount(failedCounter.get());
        job.setFinishedAt(OffsetDateTime.now());
        job.setErrorLog(formatErrorLog(errorList));
        jobRepository.save(job);
    }

    private void processSingleEmployee(
            RawEmployeeRow row,
            Path targetDir,
            ConcurrentLinkedQueue<ValidEmployeeRecord> queue,
            AtomicInteger processedCounter,
            AtomicInteger failedCounter,
            List<String> errorList) {

        processedCounter.incrementAndGet();

        try {
            // Tìm tệp ảnh tương ứng trong thư mục giải nén
            Path imgPath = resolveImagePath(targetDir, row.imagePath());
            if (imgPath == null || !Files.exists(imgPath)) {
                failedCounter.incrementAndGet();
                if (errorList.size() < 100) {
                    errorList.add(String.format("Mã %s: Không tìm thấy tệp ảnh '%s'", row.employeeCode(), row.imagePath()));
                }
                return;
            }

            // Đọc ảnh và chuyển Base64
            byte[] imgBytes = Files.readAllBytes(imgPath);
            String base64Image = Base64.getEncoder().encodeToString(imgBytes);

            // Gọi AI Service trích xuất vector và thẩm định chất lượng
            AiExtractEmbeddingResponseDto aiRes = aiFaceService.extractEmbeddingFromBase64(base64Image);
            if (!aiRes.isSuccess()) {
                failedCounter.incrementAndGet();
                if (errorList.size() < 100) {
                    errorList.add(String.format("Mã %s (%s): %s", row.employeeCode(), row.imagePath(), aiRes.getMessage()));
                }
                return;
            }

            // Tải ảnh đại diện lên MinIO Object Storage
            String avatarUrl;
            try (InputStream is = Files.newInputStream(imgPath)) {
                avatarUrl = storageService.uploadStream(
                        is,
                        imgBytes.length,
                        "image/jpeg",
                        "avatars",
                        "avatar_" + row.employeeCode());
            }

            // Vector đại diện
            String vectorString = aiRes.getEmbedding().toString();

            queue.add(new ValidEmployeeRecord(
                    row.employeeCode(),
                    row.fullName(),
                    row.email(),
                    row.phone(),
                    DEFAULT_PASSWORD_HASH,
                    avatarUrl,
                    vectorString));

        } catch (Exception e) {
            failedCounter.incrementAndGet();
            if (errorList.size() < 100) {
                errorList.add(String.format("Mã %s: Lỗi xử lý ngoại lệ: %s", row.employeeCode(), e.getMessage()));
            }
        }
    }

    private void flushQueueToDb(
            ConcurrentLinkedQueue<ValidEmployeeRecord> queue,
            int maxItems,
            Long roleId,
            AtomicInteger successCounter,
            Object lock) {

        List<ValidEmployeeRecord> batch = new ArrayList<>();
        synchronized (lock) {
            for (int i = 0; i < maxItems; i++) {
                ValidEmployeeRecord item = queue.poll();
                if (item == null) break;
                batch.add(item);
            }
            if (batch.isEmpty()) return;

            transactionTemplate.executeWithoutResult(status -> {
                // 1. Batch insert users
                String insertUserSql = "INSERT INTO users (employee_code, full_name, email, phone, password_hash, avatar_url, status, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW()) "
                        + "ON CONFLICT (employee_code) DO NOTHING";

                jdbcTemplate.batchUpdate(insertUserSql, batch, batch.size(), (ps, item) -> {
                    ps.setString(1, item.employeeCode());
                    ps.setString(2, item.fullName());
                    ps.setString(3, item.email());
                    ps.setString(4, item.phone());
                    ps.setString(5, item.passwordHash());
                    ps.setString(6, item.avatarUrl());
                });

                // 2. Lấy danh sách ID các nhân viên vừa chèn
                String inSql = String.join(",", Collections.nCopies(batch.size(), "?"));
                String querySql = "SELECT id, employee_code FROM users WHERE employee_code IN (" + inSql + ")";
                Object[] codeArgs = batch.stream().map(ValidEmployeeRecord::employeeCode).toArray();

                Map<String, Long> userCodeToIdMap = new HashMap<>();
                jdbcTemplate.query(querySql, (rs) -> {
                    userCodeToIdMap.put(rs.getString("employee_code"), rs.getLong("id"));
                }, codeArgs);

                // 3. Batch insert user_roles & face_data
                List<Object[]> userRoleArgs = new ArrayList<>();
                List<Object[]> faceDataArgs = new ArrayList<>();

                for (ValidEmployeeRecord item : batch) {
                    Long userId = userCodeToIdMap.get(item.employeeCode());
                    if (userId != null) {
                        userRoleArgs.add(new Object[] { userId, roleId });
                        faceDataArgs.add(new Object[] { userId, item.faceVector(), item.avatarUrl() });
                    }
                }

                if (!userRoleArgs.isEmpty()) {
                    jdbcTemplate.batchUpdate(
                            "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                            userRoleArgs);
                }

                if (!faceDataArgs.isEmpty()) {
                    jdbcTemplate.batchUpdate(
                            "INSERT INTO face_data (user_id, face_vector, front_image_url, created_at) VALUES (?, ?, ?, NOW())",
                            faceDataArgs);
                }

                successCounter.addAndGet(userRoleArgs.size());
            });
        }
    }

    private Path resolveImagePath(Path targetDir, String rawImagePath) {
        if (rawImagePath == null || rawImagePath.isBlank()) return null;

        String clean = rawImagePath.replace("\\", "/").trim();
        Path candidate1 = targetDir.resolve(clean);
        if (Files.exists(candidate1)) return candidate1;

        // Nếu đường dẫn là 1.jpg nhưng nằm trong thư mục con val/1.jpg
        Path candidate2 = targetDir.resolve("val").resolve(clean);
        if (Files.exists(candidate2)) return candidate2;

        // Lấy tên file đơn thuần
        String fileName = Paths.get(clean).getFileName().toString();
        Path candidate3 = targetDir.resolve(fileName);
        if (Files.exists(candidate3)) return candidate3;

        Path candidate4 = targetDir.resolve("val").resolve(fileName);
        if (Files.exists(candidate4)) return candidate4;

        return null;
    }

    private Path findCsvFile(Path targetDir) {
        try (Stream<Path> stream = Files.walk(targetDir, 3)) {
            return stream
                    .filter(p -> Files.isRegularFile(p) && p.toString().toLowerCase().endsWith(".csv"))
                    .findFirst()
                    .orElse(null);
        } catch (IOException e) {
            log.error("Lỗi khi tìm kiếm tệp CSV trong {}: {}", targetDir, e.getMessage());
            return null;
        }
    }

    private List<RawEmployeeRow> parseCsvRows(Path csvPath) throws IOException {
        List<RawEmployeeRow> result = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(Files.newInputStream(csvPath), StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null) return result;

            List<String> headers = parseCsvLine(headerLine).stream()
                    .map(String::toLowerCase)
                    .map(String::trim)
                    .toList();

            int codeIdx = findHeaderIndex(headers, "employee_code", "mã_nv", "code");
            int nameIdx = findHeaderIndex(headers, "full_name", "họ_tên", "name");
            int emailIdx = findHeaderIndex(headers, "email");
            int phoneIdx = findHeaderIndex(headers, "phone", "sđt", "phone_number");
            int imgIdx = findHeaderIndex(headers, "image_path", "image", "ảnh", "file", "path");

            // Kiểm tra format FairFace: file,age,gender,race,service_test
            boolean isFairFace = imgIdx != -1 && codeIdx == -1;

            String line;
            int rowNum = 0;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                rowNum++;
                List<String> cols = parseCsvLine(line);
                if (cols.isEmpty()) continue;

                String empCode;
                String fullName;
                String email;
                String phone;
                String imgPath = imgIdx != -1 && imgIdx < cols.size() ? cols.get(imgIdx) : "";

                if (isFairFace) {
                    // Tự động sinh mã nhân viên chuẩn hóa từ FairFace index
                    empCode = String.format("EMP_FF_%05d", rowNum);
                    fullName = "FairFace Employee #" + rowNum;
                    email = String.format("ff_user_%05d@emanagement.com", rowNum);
                    phone = String.format("09%08d", rowNum % 100000000);
                } else {
                    empCode = codeIdx != -1 && codeIdx < cols.size() ? ZipSecurityValidator.sanitizeCsvValue(cols.get(codeIdx)) : String.format("EMP_AUTO_%05d", rowNum);
                    fullName = nameIdx != -1 && nameIdx < cols.size() ? ZipSecurityValidator.sanitizeCsvValue(cols.get(nameIdx)) : "Nhân Viên #" + rowNum;
                    email = emailIdx != -1 && emailIdx < cols.size() ? ZipSecurityValidator.sanitizeCsvValue(cols.get(emailIdx)) : String.format("employee_%05d@emanagement.com", rowNum);
                    phone = phoneIdx != -1 && phoneIdx < cols.size() ? ZipSecurityValidator.sanitizeCsvValue(cols.get(phoneIdx)) : null;
                }

                if (empCode.isBlank() || imgPath.isBlank()) continue;
                result.add(new RawEmployeeRow(empCode, fullName, email, phone, imgPath));
            }
        }
        return result;
    }

    private int findHeaderIndex(List<String> headers, String... aliases) {
        for (int i = 0; i < headers.size(); i++) {
            String h = headers.get(i).replace("\"", "").trim();
            for (String alias : aliases) {
                if (h.equalsIgnoreCase(alias)) {
                    return i;
                }
            }
        }
        return -1;
    }

    public static List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        if (line == null) return values;
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '\"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '\"') {
                    sb.append('\"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                values.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        values.add(sb.toString().trim());
        return values;
    }

    private Long getRoleId(String roleName) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT id FROM roles WHERE name = ? LIMIT 1",
                    Long.class,
                    roleName);
        } catch (Exception e) {
            log.warn("Chưa tìm thấy role '{}', sử dụng fallback ID = 2", roleName);
            return 2L;
        }
    }

    private String formatErrorLog(List<String> errorList) {
        if (errorList == null || errorList.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        int displayCount = Math.min(errorList.size(), 50);
        for (int i = 0; i < displayCount; i++) {
            sb.append(i + 1).append(". ").append(errorList.get(i)).append("\n");
        }
        if (errorList.size() > displayCount) {
            sb.append("... và còn ").append(errorList.size() - displayCount).append(" lỗi khác.");
        }
        return sb.toString();
    }

    private BulkImportJobDto mapToDto(BulkImportJob job) {
        int total = job.getTotalRecords() != null ? job.getTotalRecords() : 0;
        int processed = job.getProcessedRecords() != null ? job.getProcessedRecords() : 0;
        double progress = total > 0 ? Math.round((double) processed / total * 1000.0) / 10.0 : 0.0;

        String createdByName = job.getCreatedBy() != null ? job.getCreatedBy().getFullName() : "Hệ thống";

        return BulkImportJobDto.builder()
                .id(job.getId())
                .fileName(job.getFileName())
                .fileSize(job.getFileSize())
                .status(job.getStatus())
                .totalRecords(total)
                .processedRecords(processed)
                .successCount(job.getSuccessCount() != null ? job.getSuccessCount() : 0)
                .failedCount(job.getFailedCount() != null ? job.getFailedCount() : 0)
                .progressPercentage(progress)
                .errorLog(job.getErrorLog())
                .createdByUserName(createdByName)
                .startedAt(job.getStartedAt())
                .finishedAt(job.getFinishedAt())
                .createdAt(job.getCreatedAt())
                .build();
    }

    private record RawEmployeeRow(String employeeCode, String fullName, String email, String phone, String imagePath) {}

    private record ValidEmployeeRecord(String employeeCode, String fullName, String email, String phone, String passwordHash, String avatarUrl, String faceVector) {}
}
