package com.emanagement.backend.modules.face;

import java.util.List;
import com.emanagement.backend.modules.face.dto.AiCandidateDto;
import com.emanagement.backend.modules.face.dto.AiEnrollResponseDto;
import com.emanagement.backend.modules.face.dto.AiRecognizeResponseDto;

public interface AiFaceService {
    AiEnrollResponseDto enrollFace(Long userId, List<String> imagesBase64);

    AiRecognizeResponseDto recognizeFace(String imageFrameBase64, List<AiCandidateDto> candidates);

    List<Double> extractEmbedding(byte[] imageBytes);

    AiMatchResult matchFace(List<Double> newVector, List<List<Double>> registeredVectors);
}
