package com.emanagement.backend.modules.face;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import com.emanagement.backend.modules.face.dto.AiCandidateDto;
import com.emanagement.backend.modules.face.dto.AiEnrollResponseDto;
import com.emanagement.backend.modules.face.dto.AiRecognizeResponseDto;

@Service
@ConditionalOnProperty(name = "ai-service.mock-enabled", havingValue = "true", matchIfMissing = true)
public class MockAiFaceServiceImpl implements AiFaceService {

    @Override
    public AiEnrollResponseDto enrollFace(Long userId, List<String> imagesBase64) {
        List<Double> mockVector = extractEmbedding(new byte[0]);
        return new AiEnrollResponseDto(userId, mockVector, 0.95, imagesBase64 != null ? imagesBase64.size() : 1);
    }

    @Override
    public AiRecognizeResponseDto recognizeFace(String imageFrameBase64, List<AiCandidateDto> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return new AiRecognizeResponseDto(false, null, 0.0, "UNKNOWN_FACE");
        }
        AiCandidateDto top1 = candidates.get(0);
        return new AiRecognizeResponseDto(true, top1.getUserId(), 0.96, "MATCHED");
    }

    @Override
    public List<Double> extractEmbedding(byte[] imageBytes) {
        List<Double> mockVector = new ArrayList<>();
        Random random = new Random(42);
        for (int i = 0; i < 128; i++) {
            mockVector.add(Math.round((random.nextDouble() * 2 - 1) * 10000.0) / 10000.0);
        }
        return mockVector;
    }

    @Override
    public AiMatchResult matchFace(List<Double> newVector, List<List<Double>> registeredVectors) {
        if (registeredVectors == null || registeredVectors.isEmpty()) {
            return new AiMatchResult(false, -1, 0.0);
        }
        return new AiMatchResult(true, 0, 95.5);
    }
}
