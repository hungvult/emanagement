package com.emanagement.backend.modules.face.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AiApiResponse<T> {
    private boolean success;
    private String status;
    private String message;
    private T data;
}
