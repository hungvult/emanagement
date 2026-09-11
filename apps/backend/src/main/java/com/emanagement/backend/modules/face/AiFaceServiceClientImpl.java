package com.emanagement.backend.modules.face;

import java.util.Collections;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.modules.face.dto.AiApiResponse;
import com.emanagement.backend.modules.face.dto.AiCandidateDto;
import com.emanagement.backend.modules.face.dto.AiEnrollRequestDto;
import com.emanagement.backend.modules.face.dto.AiEnrollResponseDto;
import com.emanagement.backend.modules.face.dto.AiRecognizeRequestDto;
import com.emanagement.backend.modules.face.dto.AiRecognizeResponseDto;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@ConditionalOnProperty(name = "ai-service.mock-enabled", havingValue = "false")
public class AiFaceServiceClientImpl implements AiFaceService {

    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final String enrollEndpoint;
    private final String recognizeEndpoint;

    public AiFaceServiceClientImpl(
            @Value("${ai-service.base-url:http://localhost:8000}") String baseUrl,
            @Value("${ai-service.enroll-endpoint:/api/v1/cv/enroll}") String enrollEndpoint,
            @Value("${ai-service.recognize-endpoint:/api/v1/cv/recognize}") String recognizeEndpoint) {
        this.restTemplate = new RestTemplate();
        this.baseUrl = baseUrl;
        this.enrollEndpoint = enrollEndpoint;
        this.recognizeEndpoint = recognizeEndpoint;
    }

    @Override
    public AiEnrollResponseDto enrollFace(Long userId, List<String> imagesBase64) {
        String url = baseUrl + enrollEndpoint;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            AiEnrollRequestDto requestDto = new AiEnrollRequestDto(userId, imagesBase64);
            HttpEntity<AiEnrollRequestDto> entity = new HttpEntity<>(requestDto, headers);

            ResponseEntity<AiApiResponse<AiEnrollResponseDto>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<AiApiResponse<AiEnrollResponseDto>>() {});

            AiApiResponse<AiEnrollResponseDto> body = response.getBody();
            if (body != null && body.isSuccess() && body.getData() != null) {
                return body.getData();
            } else {
                String errorMsg = body != null ? body.getMessage() : "Lỗi không xác định từ AI Service";
                throw new BusinessException(errorMsg);
            }
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            log.error("Lỗi khi kết nối HTTP sang CV Service enroll API: {}", e.getMessage(), e);
            throw new BusinessException("Không thể kết nối đến dịch vụ xử lý khuôn mặt AI: " + e.getMessage());
        }
    }

    @Override
    public AiRecognizeResponseDto recognizeFace(String imageFrameBase64, List<AiCandidateDto> candidates) {
        String url = baseUrl + recognizeEndpoint;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            AiRecognizeRequestDto requestDto = new AiRecognizeRequestDto(imageFrameBase64, candidates);
            HttpEntity<AiRecognizeRequestDto> entity = new HttpEntity<>(requestDto, headers);

            ResponseEntity<AiApiResponse<AiRecognizeResponseDto>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<AiApiResponse<AiRecognizeResponseDto>>() {});

            AiApiResponse<AiRecognizeResponseDto> body = response.getBody();
            if (body != null && body.getData() != null) {
                return body.getData();
            } else {
                String status = body != null ? body.getStatus() : "INTERNAL_ERROR";
                return new AiRecognizeResponseDto(false, null, 0.0, status);
            }
        } catch (Exception e) {
            log.error("Lỗi khi kết nối HTTP sang CV Service recognize API: {}", e.getMessage(), e);
            return new AiRecognizeResponseDto(false, null, 0.0, "INTERNAL_ERROR");
        }
    }

    @Override
    public List<Double> extractEmbedding(byte[] imageBytes) {
        return Collections.emptyList();
    }

    @Override
    public AiMatchResult matchFace(List<Double> newVector, List<List<Double>> registeredVectors) {
        return new AiMatchResult(false, -1, 0.0);
    }
}
