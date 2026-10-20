package com.emanagement.backend.common.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

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
    @DisplayName("extractObjectName: Object Key sạch chuẩn giữ nguyên không đổi (fast-path)")
    void extractObjectName_CleanObjectKey_ReturnsImmediately() {
        String inputSnapshot = "snapshots/2026/10/19/checkin_EMP001.jpg";
        assertEquals(inputSnapshot, storageService.extractObjectName(inputSnapshot));

        String inputAvatar = "avatars/2026/10/19/avatar_EMP001.jpg";
        assertEquals(inputAvatar, storageService.extractObjectName(inputAvatar));

        String inputFace = "faces/2026/10/19/ekyc_EMP001_front.jpg";
        assertEquals(inputFace, storageService.extractObjectName(inputFace));
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

    @Test
    @DisplayName("extractObjectName: chuỗi Base64 Data URI trả về null")
    void extractObjectName_DataUri_ReturnsNull() {
        assertNull(storageService.extractObjectName("data:image/jpeg;base64,/9j/4AAQSkZJRg=="));
    }

    @Test
    @DisplayName("extractObjectName: URL bên ngoài (Google, CDN) trả về null")
    void extractObjectName_ExternalHttpUrl_ReturnsNull() {
        assertNull(storageService.extractObjectName("https://lh3.googleusercontent.com/a/ACg8ocKX12345"));
        assertNull(storageService.extractObjectName("https://cdn.example.com/assets/avatar.png?ref=attendance-images"));
        assertNull(storageService.extractObjectName("https://cdn.example.com/storage/avatars/user123.jpg"));
        assertNull(storageService.extractObjectName("https://storage.googleapis.com/attendance-images/avatar.png"));
    }

    @Test
    @DisplayName("extractObjectName: đường dẫn chứa Path Traversal (..) trả về null")
    void extractObjectName_PathTraversal_ReturnsNull() {
        assertNull(storageService.extractObjectName("snapshots/../../secret.txt"));
        assertNull(storageService.extractObjectName("/storage/attendance-images/../etc/passwd"));
        assertNull(storageService.extractObjectName("..\\windows\\win.ini"));
        assertNull(storageService.extractObjectName("../secret.txt"));
        assertNull(storageService.extractObjectName("/storage/../../etc/passwd"));
        assertNull(storageService.extractObjectName("avatars/../../../app.log"));
        assertNull(storageService.extractObjectName("http://minio:9000/attendance-images/../secret.jpg"));
        assertNull(storageService.extractObjectName("snapshots/%2e%2e/%2e%2e/secret.txt"));
        assertNull(storageService.extractObjectName("%2e%2e/secret.txt"));
        assertNull(storageService.extractObjectName("%2e%2e%2fsecret.txt"));
        assertNull(storageService.extractObjectName("%2E%2E/secret.txt"));
        assertNull(storageService.extractObjectName("avatars/%252e%252e/secret.txt"));
        assertNull(storageService.extractObjectName("http://minio:9000/attendance-images/%2e%2e/secret.jpg"));
    }

    @Test
    @DisplayName("extractObjectName: URL bên ngoài chứa đường dẫn /storage/ vẫn trả về null")
    void extractObjectName_ExternalUrlWithStoragePath_ReturnsNull() {
        assertNull(storageService.extractObjectName("https://external-cdn.com/storage/avatars/user.jpg"));
        assertNull(storageService.extractObjectName("https://cdn.supabase.co/storage/v1/object/public/avatars/123.jpg"));
        assertNull(storageService.extractObjectName("http://other-service.com:8080/storage/snapshots/checkin.jpg"));
    }

    @Test
    @DisplayName("extractObjectName: URL mang tên bucket khác (attendance-images-prod) vẫn bóc tách đúng thư mục chuẩn")
    void extractObjectName_DifferentBucketName_ReturnsCleanPath() {
        String input = "/storage/attendance-images-prod/snapshots/2026/09/27/checkin_EMP001.jpg";
        String expected = "snapshots/2026/09/27/checkin_EMP001.jpg";
        assertEquals(expected, storageService.extractObjectName(input));
    }

    @Test
    @DisplayName("extractObjectName: tiền tố storage/ không có leading slash")
    void extractObjectName_StorageWithoutLeadingSlash_ReturnsCleanPath() {
        String input = "storage/snapshots/2026/09/27/checkin_EMP001.jpg";
        String expected = "snapshots/2026/09/27/checkin_EMP001.jpg";
        assertEquals(expected, storageService.extractObjectName(input));
    }

    @Test
    @DisplayName("extractObjectName: URL MinIO với IP nội bộ khi được cấu hình endpoint")
    void extractObjectName_ConfiguredEndpointHost_ReturnsCleanPath() {
        MinioStorageServiceImpl customService = new MinioStorageServiceImpl(
                minioClient, bucketName, publicUrl, "http://192.168.1.100:9000");
        String input = "http://192.168.1.100:9000/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg";
        String expected = "snapshots/2026/09/27/checkin_EMP001.jpg";
        assertEquals(expected, customService.extractObjectName(input));

        // Khi không được cấu hình endpoint, IP 192.168.x.x không tự động được xem là internal host
        assertNull(storageService.extractObjectName(input));
    }

    @Test
    @DisplayName("extractObjectName: Non-HTTP URI Schemes trả về null")
    void extractObjectName_NonHttpSchemes_ReturnsNull() {
        assertNull(storageService.extractObjectName("file:///etc/passwd"));
        assertNull(storageService.extractObjectName("ftp://evil.com/img.jpg"));
        assertNull(storageService.extractObjectName("javascript:alert(1)"));
    }

    @Test
    @DisplayName("extractObjectName: Attacker host với port 9000 trả về null")
    void extractObjectName_AttackerHostWithPort9000_ReturnsNull() {
        assertNull(storageService.extractObjectName("http://attacker-evil.com:9000/avatars/test.jpg"));
        assertNull(storageService.extractObjectName("http://evil-minio.com:9000/attendance-images/test.jpg"));
        assertNull(storageService.extractObjectName("http://minio.attacker.com:9000/attendance-images/test.jpg"));
    }

    @Test
    @DisplayName("extractObjectName: Malformed percent-encoding trả về null")
    void extractObjectName_MalformedPercentEncoding_ReturnsNull() {
        assertNull(storageService.extractObjectName("%u002e%u002e"));
        assertNull(storageService.extractObjectName("%u002e%u002e/secret.txt"));
        assertNull(storageService.extractObjectName("avatars/%u002e%u002e/test.jpg"));
        assertNull(storageService.extractObjectName("snapshots/%zz/test.jpg"));
    }

    @Test
    @DisplayName("extractObjectName: Non-HTTP URI Schemes có leading slash trả về null")
    void extractObjectName_NonHttpSchemesWithLeadingSlashes_ReturnsNull() {
        assertNull(storageService.extractObjectName("/file:///etc/passwd"));
        assertNull(storageService.extractObjectName("//file:///etc/passwd"));
        assertNull(storageService.extractObjectName("///file:///etc/passwd"));
        assertNull(storageService.extractObjectName("/ftp://evil.com/img.jpg"));
        assertNull(storageService.extractObjectName("/javascript:alert(1)"));
        assertNull(storageService.extractObjectName("blob:http://localhost:9000/uuid"));
        assertNull(storageService.extractObjectName("file:etc/passwd"));
    }

    @Test
    @DisplayName("extractObjectName: Protocol-relative URLs kiểm tra host chặt chẽ")
    void extractObjectName_ProtocolRelativeUrls() {
        // Attacker external protocol-relative URLs
        assertNull(storageService.extractObjectName("//attacker-evil.com/avatars/test.jpg"));
        assertNull(storageService.extractObjectName("//attacker-evil.com:9000/avatars/test.jpg"));
        assertNull(storageService.extractObjectName("//evil.com/etc/passwd"));

        // Internal protocol-relative URL
        assertEquals("avatars/test.jpg", storageService.extractObjectName("//localhost:9000/attendance-images/avatars/test.jpg"));
    }

    @Test
    @DisplayName("extractObjectName: Root path và slash đơn trả về null")
    void extractObjectName_RootAndSlashPaths_ReturnsNull() {
        assertNull(storageService.extractObjectName("/"));
        assertNull(storageService.extractObjectName("///"));
        assertNull(storageService.extractObjectName("/storage/"));
        assertNull(storageService.extractObjectName("http://localhost:9000/"));
    }

    @Test
    @DisplayName("extractObjectName: Multi-encoded path traversal trả về null")
    void extractObjectName_MultiEncodedPathTraversal_ReturnsNull() {
        assertNull(storageService.extractObjectName("%252e%252e"));
        assertNull(storageService.extractObjectName("%252e%252e/secret.txt"));
        assertNull(storageService.extractObjectName("%25252e%25252e/secret.txt"));
    }

    @Test
    @DisplayName("extractObjectName: Filename chứa ký tự : sau thư mục chuẩn vẫn hợp lệ")
    void extractObjectName_ColonsInFilename_Valid() {
        assertEquals("snapshots/2026/10/20/checkin_12:30:00.jpg",
                storageService.extractObjectName("snapshots/2026/10/20/checkin_12:30:00.jpg"));
        assertEquals("snapshots/2026/10/20/checkin_12:30:00.jpg",
                storageService.extractObjectName("/storage/attendance-images/snapshots/2026/10/20/checkin_12:30:00.jpg"));
    }

    @Test
    @DisplayName("isInternalHost: kiểm tra chặt chẽ host và port")
    void isInternalHost_StrictValidation() {
        // Hợp lệ
        assertTrue(storageService.isInternalHost("localhost", 9000));
        assertTrue(storageService.isInternalHost("127.0.0.1", 9000));
        assertTrue(storageService.isInternalHost("minio", 9000));
        assertTrue(storageService.isInternalHost("localhost", 80));
        assertTrue(storageService.isInternalHost("localhost", 443));
        assertTrue(storageService.isInternalHost("localhost", -1));
        assertTrue(storageService.isInternalHost("::1", 9000));
        assertTrue(storageService.isInternalHost("[::1]", 9000));

        // Không hợp lệ: Attacker host
        assertFalse(storageService.isInternalHost("attacker-evil.com", 9000));
        assertFalse(storageService.isInternalHost("minio.attacker.com", 9000));

        // Không hợp lệ: Private IP không được khai báo làm endpoint
        assertFalse(storageService.isInternalHost("192.168.1.1", 9000));
        assertFalse(storageService.isInternalHost("10.0.0.1", 9000));
        assertFalse(storageService.isInternalHost("172.16.0.1", 9000));

        // Không hợp lệ: Port không khớp
        assertFalse(storageService.isInternalHost("localhost", 3000));
        assertFalse(storageService.isInternalHost("minio", 8080));

        // Null hoặc blank
        assertFalse(storageService.isInternalHost(null, 9000));
        assertFalse(storageService.isInternalHost("   ", 9000));
    }

    @Test
    @DisplayName("Constructor: endpoint với host có dấu gạch dưới bóc tách đúng host và port")
    void constructor_UnderscoreInHost_ParsesCorrectly() {
        MinioStorageServiceImpl underscoreService = new MinioStorageServiceImpl(
                minioClient, bucketName, publicUrl, "http://minio_service:9000");
        assertTrue(underscoreService.isInternalHost("minio_service", 9000));
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

        String externalWithStoragePath = "https://cdn.example.com/storage/avatars/user.jpg";
        assertEquals(externalWithStoragePath, storageService.getPresignedUrl(externalWithStoragePath, 15));

        verifyNoInteractions(minioClient);
    }

    @Test
    @DisplayName("getPresignedUrl: path traversal trả về raw string an toàn không gọi MinIO")
    void getPresignedUrl_PathTraversal_ReturnsRawStringSafely() {
        String traversalPath = "../secret/admin.png";
        assertEquals(traversalPath, storageService.getPresignedUrl(traversalPath, 15));

        String traversalWithStorage = "/storage/../../etc/passwd";
        assertEquals(traversalWithStorage, storageService.getPresignedUrl(traversalWithStorage, 15));

        String urlEncodedTraversal = "snapshots/%2e%2e/secret.txt";
        assertEquals(urlEncodedTraversal, storageService.getPresignedUrl(urlEncodedTraversal, 15));

        verifyNoInteractions(minioClient);
    }

    @Test
    @DisplayName("getPresignedUrl: Object Key sạch sinh thành công Presigned URL")
    void getPresignedUrl_CleanObjectKey_ReturnsSignedPresignedUrl() throws Exception {
        String objectKey = "snapshots/2026/10/19/checkin_EMP001.jpg";
        String minioSignedUrl = "http://minio:9000/attendance-images/snapshots/2026/10/19/checkin_EMP001.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abcdef123456";

        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn(minioSignedUrl);

        String result = storageService.getPresignedUrl(objectKey, 15);

        assertNotNull(result);
        assertTrue(result.startsWith("/storage/attendance-images/snapshots/2026/10/19/checkin_EMP001.jpg?X-Amz-Algorithm"));
        assertTrue(result.contains("X-Amz-Signature=abcdef123456"));
    }

    @Test
    @DisplayName("getPresignedUrl: URL nội bộ hợp lệ sinh thành công Presigned URL (tương thích ngược)")
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
    @DisplayName("getPresignedUrl: URL MinIO với endpoint IP nội bộ (192.168.x.x:9000) sinh thành công Presigned URL")
    void getPresignedUrl_InternalIpUrl_ReturnsSignedPresignedUrl() throws Exception {
        MinioStorageServiceImpl customService = new MinioStorageServiceImpl(
                minioClient, bucketName, publicUrl, "http://192.168.1.100:9000");
        String internalIpUrl = "http://192.168.1.100:9000/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg";
        String minioSignedUrl = "http://minio:9000/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abcdef123456";

        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenReturn(minioSignedUrl);

        String result = customService.getPresignedUrl(internalIpUrl, 15);

        assertNotNull(result);
        assertTrue(result.startsWith("/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg?X-Amz-Algorithm"));
        assertTrue(result.contains("X-Amz-Signature=abcdef123456"));

        // Khi dùng default storageService (endpoint localhost:9000), 192.168.1.100 không phải internal host, trả về nguyên bản không ký
        String unconfiguredResult = storageService.getPresignedUrl(internalIpUrl, 15);
        assertEquals(internalIpUrl, unconfiguredResult);
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
    @DisplayName("getPresignedUrl: MinIO client ném ngoại lệ fallback về URL tương đối chuẩn an toàn")
    void getPresignedUrl_MinioException_FallsBackToStandardUrl() throws Exception {
        String storedPath = "/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg";

        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenThrow(new RuntimeException("MinIO connection timed out"));

        String result = storageService.getPresignedUrl(storedPath, 15);

        assertEquals("/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg", result);
    }

    @Test
    @DisplayName("getPresignedUrl: MinIO client ném ngoại lệ khi truyền Object Key fallback về URL tương đối chuẩn")
    void getPresignedUrl_MinioExceptionWithCleanKey_FallsBackToStandardUrl() throws Exception {
        String cleanKey = "snapshots/2026/10/19/checkin_EMP001.jpg";

        when(minioClient.getPresignedObjectUrl(any(GetPresignedObjectUrlArgs.class)))
                .thenThrow(new RuntimeException("MinIO connection timed out"));

        String result = storageService.getPresignedUrl(cleanKey, 15);

        assertEquals("/storage/attendance-images/snapshots/2026/10/19/checkin_EMP001.jpg", result);
    }

    // =========================================================================
    // 3. uploadBase64Image Tests
    // =========================================================================

    @Test
    @DisplayName("uploadBase64Image: null hoặc rỗng ném IllegalArgumentException")
    void uploadBase64Image_NullOrEmpty_ThrowsException() {
        assertThrows(IllegalArgumentException.class, () -> storageService.uploadBase64Image(null, "snapshots", "img"));
        assertThrows(IllegalArgumentException.class, () -> storageService.uploadBase64Image("   ", "snapshots", "img"));
    }

    @Test
    @DisplayName("uploadBase64Image: Base64 hợp lệ upload MinIO và trả về Object Key chuẩn")
    void uploadBase64Image_ValidBase64_Success() throws Exception {
        when(minioClient.bucketExists(any(BucketExistsArgs.class))).thenReturn(true);

        String base64Jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
        String result = storageService.uploadBase64Image(base64Jpeg, "snapshots", "test_user");

        assertNotNull(result);
        assertFalse(result.startsWith("/storage/"));
        assertTrue(result.startsWith("snapshots/"));
        assertTrue(result.contains("test_user_"));
        assertTrue(result.endsWith(".jpg"));

        verify(minioClient, times(1)).putObject(any(PutObjectArgs.class));
    }

    // =========================================================================
    // 4. uploadStream Tests
    // =========================================================================

    @Test
    @DisplayName("uploadStream: InputStream null ném IllegalArgumentException")
    void uploadStream_NullStream_ThrowsException() {
        assertThrows(IllegalArgumentException.class, () ->
                storageService.uploadStream(null, 100, "image/jpeg", "avatars", "test"));
    }

    @Test
    @DisplayName("uploadStream: InputStream hợp lệ upload MinIO và trả về Object Key chuẩn")
    void uploadStream_ValidStream_Success() throws Exception {
        when(minioClient.bucketExists(any(BucketExistsArgs.class))).thenReturn(true);

        byte[] sampleBytes = new byte[] { 1, 2, 3, 4 };
        try (InputStream stream = new ByteArrayInputStream(sampleBytes)) {
            String result = storageService.uploadStream(stream, sampleBytes.length, "image/jpeg", "avatars", "avatar_EMP001");

            assertNotNull(result);
            assertFalse(result.startsWith("/storage/"));
            assertTrue(result.startsWith("avatars/"));
            assertTrue(result.contains("avatar_EMP001_"));
            assertTrue(result.endsWith(".jpg"));

            verify(minioClient, times(1)).putObject(any(PutObjectArgs.class));
        }
    }

    // =========================================================================
    // 5. deleteImageByUrl Tests
    // =========================================================================

    @Test
    @DisplayName("deleteImageByUrl: xóa thành công khi truyền legacy URL")
    void deleteImageByUrl_ValidLegacyUrl_CallsRemoveObject() throws Exception {
        String targetUrl = "/storage/attendance-images/snapshots/2026/09/27/checkin_EMP001.jpg";

        storageService.deleteImageByUrl(targetUrl);

        verify(minioClient, times(1)).removeObject(any(RemoveObjectArgs.class));
    }

    @Test
    @DisplayName("deleteImageByUrl: xóa thành công khi truyền Object Key sạch")
    void deleteImageByUrl_CleanObjectKey_CallsRemoveObject() throws Exception {
        String cleanKey = "snapshots/2026/10/19/checkin_EMP001.jpg";

        storageService.deleteImageByUrl(cleanKey);

        verify(minioClient, times(1)).removeObject(any(RemoveObjectArgs.class));
    }

    @Test
    @DisplayName("deleteImageByUrl: URL null hoặc rỗng không gọi MinIO")
    void deleteImageByUrl_NullOrBlank_NoAction() throws Exception {
        storageService.deleteImageByUrl(null);
        storageService.deleteImageByUrl("   ");

        verify(minioClient, never()).removeObject(any(RemoveObjectArgs.class));
    }

    @Test
    @DisplayName("deleteImageByUrl: chuỗi Base64 Data URI không gọi MinIO xóa")
    void deleteImageByUrl_DataUri_NoAction() throws Exception {
        storageService.deleteImageByUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==");

        verify(minioClient, never()).removeObject(any(RemoveObjectArgs.class));
    }

    @Test
    @DisplayName("deleteImageByUrl: URL bên ngoài (Google, CDN) không gọi MinIO xóa")
    void deleteImageByUrl_ExternalUrl_NoAction() throws Exception {
        storageService.deleteImageByUrl("https://lh3.googleusercontent.com/avatar.jpg");
        storageService.deleteImageByUrl("https://cdn.example.com/assets/avatar.png?ref=attendance-images");
        storageService.deleteImageByUrl("https://cdn.example.com/storage/avatars/user.jpg");

        verify(minioClient, never()).removeObject(any(RemoveObjectArgs.class));
    }

    @Test
    @DisplayName("deleteImageByUrl: đường dẫn chứa Path Traversal không gọi MinIO xóa")
    void deleteImageByUrl_PathTraversal_NoAction() throws Exception {
        storageService.deleteImageByUrl("snapshots/../../secret.txt");
        storageService.deleteImageByUrl("/storage/../../etc/passwd");
        storageService.deleteImageByUrl("snapshots/%2e%2e/secret.txt");
        storageService.deleteImageByUrl("%2e%2e%2fsecret.txt");

        verify(minioClient, never()).removeObject(any(RemoveObjectArgs.class));
    }

    @Test
    @DisplayName("deleteImageByUrl: Non-HTTP schemes, attacker host port 9000 và malformed percent-encoding không gọi MinIO xóa")
    void deleteImageByUrl_SecurityAttacks_NoAction() throws Exception {
        storageService.deleteImageByUrl("file:///etc/passwd");
        storageService.deleteImageByUrl("ftp://evil.com/img.jpg");
        storageService.deleteImageByUrl("javascript:alert(1)");
        storageService.deleteImageByUrl("http://attacker-evil.com:9000/avatars/test.jpg");
        storageService.deleteImageByUrl("%u002e%u002e");

        verify(minioClient, never()).removeObject(any(RemoveObjectArgs.class));
    }

    @Test
    @DisplayName("deleteImageByUrl: Protocol-relative attacker URL và leading-slash non-http schemes không gọi MinIO xóa")
    void deleteImageByUrl_MoreAttacks_NoAction() throws Exception {
        storageService.deleteImageByUrl("/file:///etc/passwd");
        storageService.deleteImageByUrl("//attacker-evil.com/avatars/victim.jpg");
        storageService.deleteImageByUrl("/javascript:alert(1)");
        storageService.deleteImageByUrl("%252e%252e/secret.txt");

        verify(minioClient, never()).removeObject(any(RemoveObjectArgs.class));
    }
}

