package com.emanagement.backend.common.service;

import java.io.ByteArrayInputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import lombok.extern.slf4j.Slf4j;

/**
 * Storage service implementation leveraging MinIO object storage.
 * Handles Base64 decoding, MIME identification, dynamic bucket provisioning,
 * date-partitioned path generation, and stream upload to MinIO.
 */
@Slf4j
@Service
public class MinioStorageServiceImpl implements StorageService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy/MM/dd");

    private final MinioClient minioClient;
    private final String bucketName;
    private final String publicUrl;

    public MinioStorageServiceImpl(
            MinioClient minioClient,
            @Value("${minio.bucket-name:attendance-images}") String bucketName,
            @Value("${minio.public-url:http://localhost:9000}") String publicUrl) {
        this.minioClient = minioClient;
        String sanitizedBucket = (bucketName != null) ? bucketName.trim().replaceAll("^/+|/+$", "") : "";
        this.bucketName = sanitizedBucket.isEmpty() ? "attendance-images" : sanitizedBucket;
        String sanitizedPublicUrl = (publicUrl != null) ? publicUrl.trim().replaceAll("/+$", "") : "";
        this.publicUrl = sanitizedPublicUrl.isEmpty() ? "http://localhost:9000" : sanitizedPublicUrl;
    }

    @Override
    public String uploadBase64Image(String base64Data, String folder, String fileNamePrefix) {
        if (base64Data == null || base64Data.trim().isEmpty()) {
            throw new IllegalArgumentException("Base64 image data cannot be null or empty");
        }

        String cleanData = base64Data.trim();
        String mimeType = "image/jpeg";
        String ext = "jpg";
        String payload = cleanData;

        if (cleanData.regionMatches(true, 0, "data:", 0, 5)) {
            int commaIndex = cleanData.indexOf(",");
            if (commaIndex != -1) {
                String meta = cleanData.substring(0, commaIndex).toLowerCase();
                payload = cleanData.substring(commaIndex + 1).trim();
                if (meta.contains("image/png")) {
                    mimeType = "image/png";
                    ext = "png";
                } else if (meta.contains("image/webp")) {
                    mimeType = "image/webp";
                    ext = "webp";
                } else if (meta.contains("image/jpeg") || meta.contains("image/jpg")) {
                    mimeType = "image/jpeg";
                    ext = "jpg";
                }
            }
        }

        payload = payload.replaceAll("\\s+", "");

        byte[] imageBytes;
        try {
            imageBytes = Base64.getDecoder().decode(payload);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Failed to upload image to MinIO: invalid base64 format - " + e.getMessage(), e);
        }

        if (imageBytes.length == 0) {
            throw new RuntimeException("Failed to upload image to MinIO: decoded image content is empty");
        }

        ensureBucketExists();

        String cleanFolder = (folder != null) ? folder.trim().replaceAll("^/+|/+$", "") : "";
        if (cleanFolder.isEmpty()) {
            cleanFolder = "snapshots";
        }
        String prefix = (fileNamePrefix != null && !fileNamePrefix.trim().isEmpty())
                ? fileNamePrefix.trim()
                : "image";
        String datePath = LocalDate.now().format(DATE_FORMATTER);
        long timestamp = System.currentTimeMillis();
        String uuid = UUID.randomUUID().toString();

        String objectName = String.format("%s/%s/%s_%d_%s.%s", cleanFolder, datePath, prefix, timestamp, uuid, ext);

        try (ByteArrayInputStream bais = new ByteArrayInputStream(imageBytes)) {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .stream(bais, imageBytes.length, -1)
                            .contentType(mimeType)
                            .build()
            );
            log.info("Uploaded image successfully to MinIO: bucket={}, object={}", bucketName, objectName);
        } catch (Exception e) {
            log.error("Failed to upload image to MinIO bucket '{}', object '{}': {}", bucketName, objectName, e.getMessage(), e);
            throw new RuntimeException("Failed to upload image to MinIO: " + e.getMessage(), e);
        }

        String resultUrl = String.format("%s/%s/%s", publicUrl, bucketName, objectName);
        log.info("Public image URL generated: {}", resultUrl);
        return resultUrl;
    }

    private void ensureBucketExists() {
        try {
            boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build());
            if (!exists) {
                log.info("Bucket '{}' does not exist. Creating bucket...", bucketName);
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
                log.info("Bucket '{}' created successfully.", bucketName);
            }
        } catch (Exception e) {
            log.error("Failed to ensure MinIO bucket '{}' exists: {}", bucketName, e.getMessage(), e);
            throw new RuntimeException("Failed to upload image to MinIO: failed to ensure bucket exists - " + e.getMessage(), e);
        }
    }
}
