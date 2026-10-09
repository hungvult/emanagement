package com.emanagement.backend.modules.face.dto;

import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiExtractEmbeddingResponseDto {
    private String status;
    private String message;
    private List<Double> embedding;
    private Integer embeddingDimension;
    private Double qualityScore;
    private Integer faceCount;
    private Map<String, Object> details;

    public boolean isSuccess() {
        return "VALID".equalsIgnoreCase(status) && embedding != null && !embedding.isEmpty();
    }
}
