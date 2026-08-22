package com.emanagement.backend.modules.face;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "ai-service.mock-enabled", havingValue = "true", matchIfMissing = true)
public class MockAiFaceServiceImpl implements AiFaceService {
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
