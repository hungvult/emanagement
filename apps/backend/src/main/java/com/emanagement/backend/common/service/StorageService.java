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
}
