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
public class AiRecognizeRequestDto {
    private String imageFrameBase64;
    private List<AiCandidateDto> candidates;
}
