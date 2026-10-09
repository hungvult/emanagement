package com.emanagement.backend.modules.bulkimport.util;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.springframework.stereotype.Component;

import com.emanagement.backend.common.exception.BusinessException;

import lombok.extern.slf4j.Slf4j;

/**
 * Security validator and safe extractor for uploaded zip archives.
 * Implements defenses against:
 * 1. Magic Bytes spoofing
 * 2. Zip Slip path traversal
 * 3. Zip Bomb exhaustion (max entries, max total size, compression ratio)
 * 4. Formula injection sanitization for CSV values
 */
@Slf4j
@Component
public class ZipSecurityValidator {

    public static final int MAX_ENTRIES = 25_000;
    public static final long MAX_TOTAL_UNCOMPRESSED_BYTES = 500L * 1024 * 1024; // 500 MB
    public static final int MAX_COMPRESSION_RATIO = 100;
    private static final byte[] ZIP_MAGIC = new byte[] { 0x50, 0x4B, 0x03, 0x04 };

    /**
     * Verify magic bytes from file on disk.
     */
    public void validateZipMagicBytes(Path filePath) {
        try (InputStream is = Files.newInputStream(filePath)) {
            byte[] header = new byte[4];
            int read = is.read(header);
            if (read < 4 || header[0] != ZIP_MAGIC[0] || header[1] != ZIP_MAGIC[1]
                    || (header[2] != 0x03 && header[2] != 0x05 && header[2] != 0x07)) {
                throw new BusinessException("Tệp tải lên không phải là định dạng ZIP hợp lệ (Magic bytes mismatch).");
            }
        } catch (IOException e) {
            throw new BusinessException("Không thể đọc tệp để kiểm tra định dạng ZIP: " + e.getMessage());
        }
    }

    /**
     * Safely extract zip file into target directory with Zip Slip and Zip Bomb checks.
     */
    public void safeExtract(Path zipFilePath, Path targetDir) throws IOException {
        Files.createDirectories(targetDir);
        Path canonicalTarget = targetDir.toRealPath();

        int entryCount = 0;
        long totalBytesExtracted = 0;

        try (InputStream fis = Files.newInputStream(zipFilePath);
             BufferedInputStream bis = new BufferedInputStream(fis);
             ZipInputStream zis = new ZipInputStream(bis)) {

            ZipEntry entry;
            byte[] buffer = new byte[8192];

            while ((entry = zis.getNextEntry()) != null) {
                entryCount++;
                if (entryCount > MAX_ENTRIES) {
                    throw new BusinessException("Tệp nén chứa quá nhiều phần tử (> " + MAX_ENTRIES + "). Nguy cơ Zip Bomb.");
                }

                String entryName = entry.getName();
                Path resolvedPath = canonicalTarget.resolve(entryName).normalize();

                // Zip Slip defense
                if (!resolvedPath.startsWith(canonicalTarget)) {
                    throw new SecurityException("Phát hiện lỗ hổng Zip Slip (đường dẫn bất hợp pháp): " + entryName);
                }

                if (entry.isDirectory()) {
                    Files.createDirectories(resolvedPath);
                } else {
                    Path parent = resolvedPath.getParent();
                    if (parent != null && !Files.exists(parent)) {
                        Files.createDirectories(parent);
                    }

                    long entryBytes = 0;
                    try (FileOutputStream fos = new FileOutputStream(resolvedPath.toFile())) {
                        int len;
                        while ((len = zis.read(buffer)) > 0) {
                            fos.write(buffer, 0, len);
                            entryBytes += len;
                            totalBytesExtracted += len;

                            if (totalBytesExtracted > MAX_TOTAL_UNCOMPRESSED_BYTES) {
                                throw new BusinessException("Kích thước giải nén vượt quá giới hạn an toàn ("
                                        + (MAX_TOTAL_UNCOMPRESSED_BYTES / (1024 * 1024)) + " MB). Nguy cơ Zip Bomb.");
                            }
                        }
                    }

                    // Check compression ratio if compressed size is reported
                    long compressedSize = entry.getCompressedSize();
                    if (compressedSize > 0) {
                        double ratio = (double) entryBytes / compressedSize;
                        if (ratio > MAX_COMPRESSION_RATIO) {
                            throw new BusinessException("Tỷ lệ nén phần tử " + entryName + " bất thường ("
                                    + Math.round(ratio) + "x > " + MAX_COMPRESSION_RATIO + "x). Nguy cơ Zip Bomb.");
                        }
                    }
                }
                zis.closeEntry();
            }
        }
    }

    /**
     * Recursively delete sandbox directory.
     */
    public void cleanupSandbox(Path sandboxDir) {
        if (sandboxDir == null || !Files.exists(sandboxDir)) {
            return;
        }
        try {
            Files.walkFileTree(sandboxDir, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.deleteIfExists(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    Files.deleteIfExists(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
            log.debug("Đã dọn dẹp thư mục sandbox: {}", sandboxDir);
        } catch (Exception e) {
            log.warn("Không thể dọn dẹp toàn bộ thư mục sandbox {}: {}", sandboxDir, e.getMessage());
        }
    }

    /**
     * Sanitize string against CSV Formula Injection.
     */
    public static String sanitizeCsvValue(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        char firstChar = trimmed.charAt(0);
        if (firstChar == '=' || firstChar == '+' || firstChar == '-' || firstChar == '@'
                || firstChar == '\t' || firstChar == '\r') {
            return "'" + trimmed;
        }
        return trimmed;
    }
}
