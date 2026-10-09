package com.emanagement.backend.common.service;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.minio.BucketExistsArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.http.Method;
import lombok.extern.slf4j.Slf4j;

/**
 * Storage service implementation leveraging MinIO object storage.
 * Handles Base64 decoding, MIME identification, dynamic bucket provisioning,
 * date-partitioned path generation, and time-limited Presigned URL generation with AWS SigV4.
 */
@Slf4j
@Service
public class MinioStorageServiceImpl implements StorageService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy/MM/dd");

    private final MinioClient minioClient;
    private final String bucketName;
    private final String publicUrl;
    private final java.util.concurrent.atomic.AtomicBoolean bucketInitialized = new java.util.concurrent.atomic.AtomicBoolean(false);

    public MinioStorageServiceImpl(
            MinioClient minioClient,
            @Value("${minio.bucket-name:attendance-images}") String bucketName,
            @Value("${minio.public-url:/storage}") String publicUrl) {
        this.minioClient = minioClient;
        String sanitizedBucket = (bucketName != null) ? bucketName.trim().replaceAll("^/+|/+$", "") : "";
        this.bucketName = sanitizedBucket.isEmpty() ? "attendance-images" : sanitizedBucket;
        String sanitizedPublicUrl = (publicUrl != null) ? publicUrl.trim().replaceAll("/+$", "") : "";
        this.publicUrl = sanitizedPublicUrl.isEmpty() ? "/storage" : sanitizedPublicUrl;
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
        log.info("Public image URL stored: {}", resultUrl);
        return resultUrl;
    }

    @Override
    public String getPresignedUrl(String rawPathOrUrl, int durationMinutes) {
        if (rawPathOrUrl == null || rawPathOrUrl.trim().isEmpty()) {
            return null;
        }

        String clean = rawPathOrUrl.trim();
        // Return inline Base64 data unchanged
        if (clean.startsWith("data:")) {
            return clean;
        }

        // Return external absolute URLs unchanged unless pointing to internal endpoints
        if (clean.startsWith("http://") || clean.startsWith("https://")) {
            try {
                URI uri = URI.create(clean);
                String host = uri.getHost();
                boolean isInternalHost = "minio".equalsIgnoreCase(host)
                        || "localhost".equalsIgnoreCase(host)
                        || "127.0.0.1".equalsIgnoreCase(host);

                if (!isInternalHost && !clean.startsWith(publicUrl)) {
                    return clean;
                }
            } catch (Exception e) {
                return clean;
            }
        }

        String objectName = extractObjectName(clean);
        if (objectName == null || objectName.isEmpty()) {
            return rawPathOrUrl;
        }

        try {
            int expiry = (durationMinutes > 0) ? durationMinutes : 15;
            String presigned = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(objectName)
                            .expiry(expiry, TimeUnit.MINUTES)
                            .build()
            );

            // Convert MinIO internal endpoint host to client-accessible publicUrl
            URI uri = URI.create(presigned);
            String pathAndQuery = uri.getRawPath() + (uri.getRawQuery() != null ? "?" + uri.getRawQuery() : "");

            return publicUrl + pathAndQuery;
        } catch (Exception e) {
            log.error("Failed to generate presigned URL for object '{}': {}", objectName, e.getMessage());
            return rawPathOrUrl;
        }
    }

    @Override
    public void deleteImageByUrl(String imageUrl) {
        String objectName = extractObjectName(imageUrl);
        if (objectName != null && !objectName.isEmpty()) {
            try {
                minioClient.removeObject(
                        RemoveObjectArgs.builder()
                                .bucket(bucketName)
                                .object(objectName)
                                .build()
                );
                log.info("Deleted object successfully from MinIO: bucket={}, object={}", bucketName, objectName);
            } catch (Exception e) {
                log.warn("Failed to delete object from MinIO bucket '{}', object '{}': {}", bucketName, objectName, e.getMessage());
            }
        }
    }

    String extractObjectName(String pathOrUrl) {
        if (pathOrUrl == null || pathOrUrl.trim().isEmpty()) {
            return null;
        }
        String clean = pathOrUrl.trim();

        int qIdx = clean.indexOf("?");
        if (qIdx != -1) {
            clean = clean.substring(0, qIdx);
        }

        if (clean.startsWith("http://") || clean.startsWith("https://")) {
            try {
                clean = URI.create(clean).getPath();
            } catch (Exception ignored) {
            }
        }

        String bucketPrefix = "/" + bucketName + "/";
        if (clean.contains(bucketPrefix)) {
            int idx = clean.indexOf(bucketPrefix);
            return clean.substring(idx + bucketPrefix.length());
        }

        String bucketNoSlash = bucketName + "/";
        if (clean.contains(bucketNoSlash)) {
            int idx = clean.indexOf(bucketNoSlash);
            return clean.substring(idx + bucketNoSlash.length());
        }

        String storagePrefix = "/storage/";
        if (clean.startsWith(storagePrefix)) {
            clean = clean.substring(storagePrefix.length());
            if (clean.startsWith(bucketNoSlash)) {
                clean = clean.substring(bucketNoSlash.length());
            }
            return clean;
        }

        return clean.replaceAll("^/+", "");
    }

    @Override
    public String uploadStream(java.io.InputStream inputStream, long size, String contentType, String folder, String fileNamePrefix) {
        if (inputStream == null) {
            throw new IllegalArgumentException("InputStream cannot be null");
        }

        ensureBucketExists();

        String cleanFolder = (folder != null) ? folder.trim().replaceAll("^/+|/+$", "") : "";
        if (cleanFolder.isEmpty()) {
            cleanFolder = "avatars";
        }
        String prefix = (fileNamePrefix != null && !fileNamePrefix.trim().isEmpty())
                ? fileNamePrefix.trim()
                : "image";
        String datePath = LocalDate.now().format(DATE_FORMATTER);
        long timestamp = System.currentTimeMillis();
        String uuid = UUID.randomUUID().toString();

        String ext = "jpg";
        if (contentType != null) {
            String lower = contentType.toLowerCase();
            if (lower.contains("png")) {
                ext = "png";
            } else if (lower.contains("webp")) {
                ext = "webp";
            }
        }
        String mime = (contentType != null && !contentType.isBlank()) ? contentType : "image/jpeg";
        String objectName = String.format("%s/%s/%s_%d_%s.%s", cleanFolder, datePath, prefix, timestamp, uuid, ext);

        try {
            long partSize = (size > 0 && size <= 5L * 1024 * 1024) ? -1 : 5L * 1024 * 1024;
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .stream(inputStream, size, partSize)
                            .contentType(mime)
                            .build()
            );
            log.debug("Uploaded image stream successfully to MinIO: bucket={}, object={}", bucketName, objectName);
        } catch (Exception e) {
            log.error("Failed to upload stream to MinIO bucket '{}', object '{}': {}", bucketName, objectName, e.getMessage(), e);
            throw new RuntimeException("Failed to upload image to MinIO: " + e.getMessage(), e);
        }

        return String.format("%s/%s/%s", publicUrl, bucketName, objectName);
    }

    private void ensureBucketExists() {
        if (bucketInitialized.get()) {
            return;
        }
        synchronized (bucketInitialized) {
            if (bucketInitialized.get()) {
                return;
            }
            try {
                boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build());
                if (!exists) {
                    log.info("Bucket '{}' does not exist. Creating bucket...", bucketName);
                    minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
                    log.info("Bucket '{}' created successfully.", bucketName);
                }
                bucketInitialized.set(true);
            } catch (Exception e) {
                log.error("Failed to ensure MinIO bucket '{}' exists: {}", bucketName, e.getMessage(), e);
                throw new RuntimeException("Failed to upload image to MinIO: failed to ensure bucket exists - " + e.getMessage(), e);
            }
        }
    }
}
