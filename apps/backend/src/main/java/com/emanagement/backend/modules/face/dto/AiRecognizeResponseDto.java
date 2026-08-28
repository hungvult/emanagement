package com.emanagement.backend.modules.face.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AiRecognizeResponseDto {
    private boolean matched;
    private Long matchedUserId;
    private double similarityScore;
    private String status;
}
