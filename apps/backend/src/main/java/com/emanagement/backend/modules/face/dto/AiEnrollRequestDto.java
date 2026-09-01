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
public class AiEnrollRequestDto {
    private Long userId;
    private List<String> images;
}
