package com.emanagement.backend.common.service;

/**
 * Common storage service interface for uploading and managing files and images.
 */
public interface StorageService {

    /**
     * Upload a Base64-encoded image to object storage.
     *
     * @param base64Data     Raw Base64 string or Data URI (e.g. data:image/jpeg;base64,...)
     * @param folder         Subdirectory or prefix under bucket (e.g. "snapshots")
     * @param fileNamePrefix Prefix for the generated object file name (e.g. "checkin_EMP001")
     * @return Public URL to access the uploaded image
     */
    String uploadBase64Image(String base64Data, String folder, String fileNamePrefix);

    /**
     * Upload an InputStream directly to object storage without decoding to byte array in memory.
     *
     * @param inputStream    Input stream of the image data
     * @param size           Size of the stream in bytes (or -1 if unknown)
     * @param contentType    MIME content type (e.g. "image/jpeg")
     * @param folder         Subdirectory or prefix under bucket (e.g. "avatars")
     * @param fileNamePrefix Prefix for the generated object file name (e.g. "EMP001")
     * @return Public URL to access the uploaded image
     */
    String uploadStream(java.io.InputStream inputStream, long size, String contentType, String folder, String fileNamePrefix);

    /**
     * Generate a time-limited cryptographically signed Presigned URL for private asset access.
     *
     * @param rawPathOrUrl    Raw object path or stored URL (e.g. "/storage/attendance-images-prod/...")
     * @param durationMinutes Time-to-live for the signed URL in minutes
     * @return Presigned URL with AWS SigV4 query parameters, or raw URL if non-MinIO/empty
     */
    String getPresignedUrl(String rawPathOrUrl, int durationMinutes);

    /**
     * Delete an image from object storage given its public URL or path.
     *
     * @param imageUrl Public URL or object path of the image to delete
     */
    void deleteImageByUrl(String imageUrl);
}
