package com.emanagement.backend.modules.face.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AiEnrollResponseDto {
    private Long userId;
    private List<Double> embedding;
    private double qualityScore;
    private int processedFrames;
}
