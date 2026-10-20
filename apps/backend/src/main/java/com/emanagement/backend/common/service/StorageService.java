package com.emanagement.backend.common.service;

/**
 * Common storage service interface for uploading and managing files and images.
 * Standardizes on relative Object Key format (folder/yyyy/MM/dd/fileName.ext) as the canonical
 * identifier for stored objects across the application.
 */
public interface StorageService {

    String FOLDER_AVATARS = "avatars";
    String FOLDER_FACES = "faces";
    String FOLDER_SNAPSHOTS = "snapshots";

    /**
     * Upload a Base64-encoded image to object storage.
     *
     * @param base64Data     Raw Base64 string or Data URI (e.g. data:image/jpeg;base64,...)
     * @param folder         Subdirectory or prefix under bucket (e.g. "snapshots")
     * @param fileNamePrefix Prefix for the generated object file name (e.g. "checkin_EMP001")
     * @return Standard relative Object Key (e.g. "snapshots/yyyy/MM/dd/checkin_EMP001_timestamp_uuid.jpg")
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
     * @return Standard relative Object Key (e.g. "avatars/yyyy/MM/dd/avatar_EMP001_timestamp_uuid.jpg")
     */
    String uploadStream(java.io.InputStream inputStream, long size, String contentType, String folder, String fileNamePrefix);

    /**
     * Generate a time-limited cryptographically signed Presigned URL for private asset access.
     * Accepts both canonical Object Key (e.g. "snapshots/yyyy/MM/dd/...") and legacy URLs (e.g. "/storage/attendance-images-prod/...").
     *
     * @param rawPathOrUrl    Canonical Object Key or legacy stored URL path
     * @param durationMinutes Time-to-live for the signed URL in minutes
     * @return Presigned URL with AWS SigV4 query parameters, or raw URL if non-MinIO/empty
     */
    String getPresignedUrl(String rawPathOrUrl, int durationMinutes);

    /**
     * Delete an image from object storage given its Object Key or legacy URL path.
     *
     * @param objectKeyOrUrl Canonical Object Key or legacy stored URL path of the image to delete
     */
    void deleteImageByUrl(String objectKeyOrUrl);
}
