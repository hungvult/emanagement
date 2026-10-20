package com.emanagement.backend.common.service;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
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
    private static final java.util.regex.Pattern STANDARD_FOLDER_PATTERN = java.util.regex.Pattern.compile(
            "(?:^|/)(" + FOLDER_AVATARS + "|" + FOLDER_FACES + "|" + FOLDER_SNAPSHOTS + ")/");
    private static final java.util.regex.Pattern WHITESPACE_PATTERN = java.util.regex.Pattern.compile("\\s+");

    private final MinioClient minioClient;
    private final String bucketName;
    private final String publicUrl;
    private final String endpointHost;
    private final int endpointPort;
    private final java.util.concurrent.atomic.AtomicBoolean bucketInitialized = new java.util.concurrent.atomic.AtomicBoolean(false);

    @Autowired
    public MinioStorageServiceImpl(
            MinioClient minioClient,
            @Value("${minio.bucket-name:attendance-images}") String bucketName,
            @Value("${minio.public-url:/storage}") String publicUrl,
            @Value("${minio.endpoint:http://localhost:9000}") String endpoint) {
        this.minioClient = minioClient;
        String sanitizedBucket = (bucketName != null) ? bucketName.trim().replaceAll("^/+|/+$", "") : "";
        this.bucketName = sanitizedBucket.isEmpty() ? "attendance-images" : sanitizedBucket;
        String sanitizedPublicUrl = (publicUrl != null) ? publicUrl.trim().replaceAll("/+$", "") : "";
        this.publicUrl = sanitizedPublicUrl.isEmpty() ? "/storage" : sanitizedPublicUrl;

        String parsedHost = null;
        int parsedPort = -1;
        if (endpoint != null && !endpoint.trim().isEmpty()) {
            try {
                String trimmed = endpoint.trim();
                if (!trimmed.regionMatches(true, 0, "http://", 0, 7) && !trimmed.regionMatches(true, 0, "https://", 0, 8)) {
                    trimmed = "http://" + trimmed;
                }
                URI endpointUri = URI.create(trimmed);
                parsedHost = endpointUri.getHost();
                parsedPort = endpointUri.getPort();
                if (parsedHost == null && endpointUri.getAuthority() != null) {
                    String auth = endpointUri.getAuthority();
                    int colon = auth.lastIndexOf(':');
                    parsedHost = (colon != -1) ? auth.substring(0, colon) : auth;
                    if (parsedPort == -1 && colon != -1) {
                        try {
                            parsedPort = Integer.parseInt(auth.substring(colon + 1));
                        } catch (NumberFormatException ignored) {}
                    }
                }
                if (parsedPort == -1) {
                    parsedPort = "https".equalsIgnoreCase(endpointUri.getScheme()) ? 443 : 80;
                }
            } catch (Exception e) {
                log.warn("Failed to parse minio.endpoint '{}': {}", endpoint, e.getMessage());
            }
        }
        this.endpointHost = (parsedHost != null && !parsedHost.isBlank()) ? parsedHost.toLowerCase() : "localhost";
        this.endpointPort = (parsedPort > 0) ? parsedPort : 9000;
    }

    public MinioStorageServiceImpl(
            MinioClient minioClient,
            String bucketName,
            String publicUrl) {
        this(minioClient, bucketName, publicUrl, "http://localhost:9000");
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

        payload = WHITESPACE_PATTERN.matcher(payload).replaceAll("");

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
            cleanFolder = FOLDER_SNAPSHOTS;
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

        log.info("Stored image object key: {}", objectName);
        return objectName;
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

        String objectName = extractObjectName(clean);
        if (objectName == null || objectName.isEmpty()) {
            // External URL (e.g. Google avatar, CDN) or unextractable path
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
            return String.format("%s/%s/%s", publicUrl, bucketName, objectName);
        }
    }

    @Override
    public void deleteImageByUrl(String objectKeyOrUrl) {
        String objectName = extractObjectName(objectKeyOrUrl);
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

    boolean isInternalHost(String host, int port) {
        if (host == null || host.isBlank()) {
            return false;
        }
        String h = host.trim().toLowerCase();
        boolean hostMatches = h.equals(endpointHost)
                || h.equals("minio")
                || h.equals("localhost")
                || h.equals("127.0.0.1")
                || h.equals("::1")
                || h.equals("[::1]");

        if (!hostMatches) {
            return false;
        }

        return port == endpointPort
                || port == 9000
                || port == 80
                || port == 443
                || port == -1;
    }

    private boolean containsPathTraversal(String path) {
        if (path == null) {
            return false;
        }
        if (path.contains("..")) {
            return true;
        }
        String lower = path.toLowerCase();
        if (lower.contains("%2e%2e") || lower.contains("%2e.") || lower.contains(".%2e")) {
            return true;
        }
        try {
            String decoded = java.net.URLDecoder.decode(path, java.nio.charset.StandardCharsets.UTF_8);
            String decodedLower = decoded.toLowerCase();
            if (decoded.contains("..") || decodedLower.contains("%2e%2e") || decodedLower.contains("%2e.") || decodedLower.contains(".%2e")) {
                return true;
            }
            if (decoded.contains("%")) {
                String doubleDecoded = java.net.URLDecoder.decode(decoded, java.nio.charset.StandardCharsets.UTF_8);
                String doubleLower = doubleDecoded.toLowerCase();
                if (doubleDecoded.contains("..") || doubleLower.contains("%2e%2e") || doubleLower.contains("%2e.") || doubleLower.contains(".%2e")) {
                    return true;
                }
            }
        } catch (IllegalArgumentException e) {
            log.warn("Malformed percent-encoding detected in storage path: {}", path);
            return true;
        } catch (Exception e) {
            log.warn("Unexpected exception decoding storage path: {}", path, e);
            return true;
        }
        return false;
    }

    String extractObjectName(String pathOrUrl) {
        if (pathOrUrl == null || pathOrUrl.trim().isEmpty()) {
            return null;
        }
        String clean = pathOrUrl.trim();

        if (containsPathTraversal(clean)) {
            log.warn("Potential path traversal detected in storage path: {}", clean);
            return null;
        }

        // 1. Inline data URIs have no object name in MinIO
        if (clean.regionMatches(true, 0, "data:", 0, 5)) {
            return null;
        }

        // 2. Strip query parameters if present
        int qIdx = clean.indexOf("?");
        if (qIdx != -1) {
            clean = clean.substring(0, qIdx);
        }

        // 3. Handle protocol-relative URLs (e.g. //attacker-evil.com/... or //localhost:9000/...)
        if (clean.startsWith("//") && !clean.startsWith("///")) {
            String afterDoubleSlash = clean.substring(2);
            boolean isLocalFolder = afterDoubleSlash.startsWith(FOLDER_AVATARS + "/")
                    || afterDoubleSlash.startsWith(FOLDER_FACES + "/")
                    || afterDoubleSlash.startsWith(FOLDER_SNAPSHOTS + "/")
                    || afterDoubleSlash.startsWith("storage/")
                    || afterDoubleSlash.startsWith(bucketName + "/");
            if (!isLocalFolder) {
                clean = "http:" + clean;
            }
        }

        // 4. Reject Non-HTTP URI Schemes (e.g. file:///etc/passwd, ftp://evil.com/img.jpg, javascript:alert(1))
        // and inspect HTTP / HTTPS URLs (including cases with leading slashes)
        String schemeCandidate = clean.replaceAll("^[/\\\\]+", "");
        int colonIdx = schemeCandidate.indexOf(':');
        int slashIdx = schemeCandidate.indexOf('/');
        if (colonIdx != -1 && (slashIdx == -1 || colonIdx < slashIdx)) {
            String scheme = schemeCandidate.substring(0, colonIdx).toLowerCase();
            if ("http".equals(scheme) || "https".equals(scheme)) {
                try {
                    URI uri = URI.create(schemeCandidate);
                    String host = uri.getHost();
                    int port = uri.getPort();
                    if (port == -1) {
                        port = "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
                    }

                    boolean isInternalStorageUrl = isInternalHost(host, port)
                            || (publicUrl.startsWith("http") && (clean.startsWith(publicUrl + "/") || clean.equals(publicUrl)));

                    if (!isInternalStorageUrl) {
                        return null; // External URL (e.g. Google avatar, CDN) has no MinIO object name
                    }
                    clean = (uri.getPath() != null) ? uri.getPath() : "";
                } catch (Exception e) {
                    return null;
                }
            } else {
                log.warn("Non-HTTP URI scheme rejected: {}", clean);
                return null;
            }
        }

        if (clean == null || clean.trim().isEmpty() || clean.equals("/")) {
            return null;
        }

        // 5. Standard storage folders matching: avatars, faces, snapshots
        java.util.regex.Matcher folderMatcher = STANDARD_FOLDER_PATTERN.matcher(clean);
        if (folderMatcher.find()) {
            int start = folderMatcher.start();
            if (clean.charAt(start) == '/') {
                start++;
            }
            return clean.substring(start);
        }

        // 6. Fallback for custom folders:
        // Fast-path: already a clean relative object key
        if (!clean.startsWith("/")
                && !clean.startsWith(bucketName + "/")
                && !clean.startsWith("storage/")) {
            return clean;
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
            return clean.isEmpty() ? null : clean;
        }

        if (clean.startsWith("storage/")) {
            clean = clean.substring("storage/".length());
            if (clean.startsWith(bucketNoSlash)) {
                clean = clean.substring(bucketNoSlash.length());
            }
            return clean.isEmpty() ? null : clean;
        }

        String result = clean.replaceAll("^/+", "");
        return result.isEmpty() ? null : result;
    }

    @Override
    public String uploadStream(java.io.InputStream inputStream, long size, String contentType, String folder, String fileNamePrefix) {
        if (inputStream == null) {
            throw new IllegalArgumentException("InputStream cannot be null");
        }

        ensureBucketExists();

        String cleanFolder = (folder != null) ? folder.trim().replaceAll("^/+|/+$", "") : "";
        if (cleanFolder.isEmpty()) {
            cleanFolder = FOLDER_AVATARS;
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

        log.debug("Stored image stream object key: {}", objectName);
        return objectName;
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
