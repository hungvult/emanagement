package com.emanagement.backend.modules.alert;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.alert.dto.AnomalyAlertResponseDto;
import com.emanagement.backend.modules.alert.dto.ResolveAlertRequestDto;

public interface AlertService {
    PageResponse<AnomalyAlertResponseDto> getAlerts(Boolean isResolved, int page, int size);

    AnomalyAlertResponseDto resolveAlert(Long id, ResolveAlertRequestDto dto);
}
