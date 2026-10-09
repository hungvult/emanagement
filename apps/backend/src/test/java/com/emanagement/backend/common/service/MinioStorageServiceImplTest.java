package com.emanagement.backend.common.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import io.minio.BucketExistsArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;

@ExtendWith(MockitoExtension.class)
class MinioStorageServiceImplTest {

    @Mock
    private MinioClient minioClient;

    private MinioStorageServiceImpl storageService;
    private final String bucketName = "attendance-images";
    private final String publicUrl = "/storage";

    @BeforeEach
    void setUp() {
        storageService = new MinioStorageServiceImpl(minioClient, bucketName, publicUrl);
    }

    // =========================================================================
    // 1. extractObjectName Tests
    // =========================================================================

    @Test
    @DisplayName("extractObjectName: null hoặc chuỗi rỗng trả về null")
    void extractObjectName_NullOrBlank_ReturnsNull() {
        assertNull(storageService.extractObjectName(null));
        assertNull(storageService.extractObjectName(""));
        assertNull(storageService.extractObjectName("   "));
    }

    @Test
    @DisplayName("extractObjectName: đường dẫn bắt đầu bằng /bucketName/")
    void extractObjectName_WithSlashBucketPrefix_ReturnsCleanPath() {
        String input = "/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg";
        String expected = "snapshots/2026/09/27/checkin_EMP001.jpg";
        assertEquals(expected, storageService.extractObjectName(input));
    }

    @Test
    @DisplayName("extractObjectName: đường dẫn bắt đầu bằng bucketName/ (không có leading slash)")
    void extractObjectName_WithBucketNoSlashPrefix_ReturnsCleanPath() {
        String input = "attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg";
        String expected = "snapshots/2026/09/27/checkin_EMP001.jpg";
        assertEquals(expected, storageService.extractObjectName(input));
    }

    @Test
    @DisplayName("extractObjectName: đường dẫn bắt đầu bằng /storage/ kèm bucketName")
    void extractObjectName_WithStorageAndBucketPrefix_ReturnsCleanPath() {
        String input = "/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg";
        String expected = "snapshots/2026/09/27/checkin_EMP001.jpg";
        assertEquals(expected, storageService.extractObjectName(input));
    }

    @Test
    @DisplayName("extractObjectName: đường dẫn bắt đầu bằng /storage/ không có bucketName")
    void extractObjectName_WithStorageOnlyPrefix_ReturnsCleanPath() {
        String input = "/storage/snapshots/2026/09/27/checkin_EMP001.jpg";
        String expected = "snapshots/2026/09/27/checkin_EMP001.jpg";
        assertEquals(expected, storageService.extractObjectName(input));
    }

    @Test
    @DisplayName("extractObjectName: đường dẫn có nhiều leading slashes")
    void extractObjectName_WithMultipleLeadingSlashes_ReturnsCleanPath() {
        String input = "///snapshots/2026/09/27/checkin_EMP001.jpg";
        String expected = "snapshots/2026/09/27/checkin_EMP001.jpg";
        assertEquals(expected, storageService.extractObjectName(input));
    }

    @Test
    @DisplayName("extractObjectName: đường dẫn chứa query parameters")
    void extractObjectName_WithQueryParams_StripsQuerySuccessfully() {
        String input = "/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg?X-Amz-Signature=123&test=abc";
        String expected = "snapshots/2026/09/27/checkin_EMP001.jpg";
        assertEquals(expected, storageService.extractObjectName(input));
    }

    @Test
    @DisplayName("extractObjectName: full URL nội bộ http://minio:9000/")
    void extractObjectName_WithFullInternalHttpUrl_ReturnsCleanPath() {
        String input = "http://minio:9000/attendance-images/faces/2026/09/27/front_EMP001.jpg?token=xyz";
        String expected = "faces/2026/09/27/front_EMP001.jpg";
        assertEquals(expected, storageService.extractObjectName(input));
    }

    // =========================================================================
    // 2. getPresignedUrl Tests
    // =========================================================================

    @Test
    @DisplayName("getPresignedUrl: null hoặc blank trả về null")
    void getPresignedUrl_NullOrBlank_ReturnsNull() {
        assertNull(storageService.getPresignedUrl(null, 15));
        assertNull(storageService.getPresignedUrl("", 15));
        assertNull(storageService.getPresignedUrl("   ", 15));
    }

    @Test
    @DisplayName("getPresignedUrl: chuỗi Base64 Data URI giữ nguyên không ký")
    void getPresignedUrl_DataUri_ReturnsUnchanged() {
        String dataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD";
        assertEquals(dataUri, storageService.getPresignedUrl(dataUri, 15));
        verifyNoInteractions(minioClient);
    }

    @Test
    @DisplayName("getPresignedUrl: URL bên ngoài (Google, CDN) giữ nguyên không ký")
    void getPresignedUrl_ExternalUrl_ReturnsUnchanged() {
        String googleAvatar = "https://lh3.googleusercontent.com/a/ACg8ocKX12345";
        assertEquals(googleAvatar, storageService.getPresignedUrl(googleAvatar, 15));

        // URL ngoài có chứa chuỗi trùng bucketName trong query/path vẫn nhận diện đúng là external
        String externalWithBucketParam = "https://cdn.example.com/assets/avatar.png?ref=attendance-images";
        assertEquals(externalWithBucketParam, storageService.getPresignedUrl(externalWithBucketParam, 15));

        verifyNoInteractions(minioClient);
    }

    @Test
    @DisplayName("getPresignedUrl: URL nội bộ hợp lệ sinh thành công Presigned URL")
    void getPresignedUrl_ValidInternalPath_ReturnsSignedPresignedUrl() throws Exception {
        String storedPath = "/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg";
        String minioSignedUrl = "http://minio:9000/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abcdef123456";

        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn(minioSignedUrl);

        String result = storageService.getPresignedUrl(storedPath, 15);

        assertNotNull(result);
        assertTrue(result.startsWith("/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg?X-Amz-Algorithm"));
        assertTrue(result.contains("X-Amz-Signature=abcdef123456"));
    }

    @Test
    @DisplayName("getPresignedUrl: URL nội bộ đã có query string cũ sinh lại Presigned URL mới")
    void getPresignedUrl_InternalPathWithOldQuery_RegeneratesSuccessfully() throws Exception {
        String storedPath = "/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg?oldToken=expired";
        String minioSignedUrl = "http://minio:9000/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=newSig789";

        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn(minioSignedUrl);

        String result = storageService.getPresignedUrl(storedPath, 30);

        assertNotNull(result);
        assertTrue(result.contains("X-Amz-Signature=newSig789"));
        assertFalse(result.contains("oldToken=expired"));
    }

    @Test
    @DisplayName("getPresignedUrl: MinIO client ném ngoại lệ fallback về raw URL an toàn")
    void getPresignedUrl_MinioException_FallsBackToRawUrl() throws Exception {
        String storedPath = "/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg";

        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenThrow(new RuntimeException("MinIO connection timed out"));

        String result = storageService.getPresignedUrl(storedPath, 15);

        assertEquals(storedPath, result);
    }

    // =========================================================================
    // 3. uploadBase64Image & deleteImageByUrl Tests
    // =========================================================================

    @Test
    @DisplayName("uploadBase64Image: null hoặc rỗng ném IllegalArgumentException")
    void uploadBase64Image_NullOrEmpty_ThrowsException() {
        assertThrows(IllegalArgumentException.class, () -> storageService.uploadBase64Image(null, "snapshots", "img"));
        assertThrows(IllegalArgumentException.class, () -> storageService.uploadBase64Image("   ", "snapshots", "img"));
    }

    @Test
    @DisplayName("uploadBase64Image: Base64 hợp lệ upload MinIO và trả về URL chuẩn")
    void uploadBase64Image_ValidBase64_Success() throws Exception {
        when(minioClient.bucketExists(any(BucketExistsArgs.class))).thenReturn(true);

        String base64Jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
        String result = storageService.uploadBase64Image(base64Jpeg, "snapshots", "test_user");

        assertNotNull(result);
        assertTrue(result.startsWith("/storage/attendance-images/snapshots/"));
        assertTrue(result.contains("test_user_"));
        assertTrue(result.endsWith(".jpg"));

        verify(minioClient, times(1)).putObject(any(PutObjectArgs.class));
    }

    @Test
    @DisplayName("deleteImageByUrl: xóa thành công khi URL hợp lệ")
    void deleteImageByUrl_ValidUrl_CallsRemoveObject() throws Exception {
        String targetUrl = "/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg";

        storageService.deleteImageByUrl(targetUrl);

        verify(minioClient, times(1)).removeObject(any(RemoveObjectArgs.class));
    }

    @Test
    @DisplayName("deleteImageByUrl: URL null hoặc rỗng không gọi MinIO")
    void deleteImageByUrl_NullOrBlank_NoAction() throws Exception {
        storageService.deleteImageByUrl(null);
        storageService.deleteImageByUrl("   ");

        verify(minioClient, never()).removeObject(any(RemoveObjectArgs.class));
    }
}
