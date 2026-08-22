package com.emanagement.backend.modules.face;

import java.util.List;

public interface AiFaceService {
    List<Double> extractEmbedding(byte[] imageBytes);

    AiMatchResult matchFace(List<Double> newVector, List<List<Double>> registeredVectors);
}
