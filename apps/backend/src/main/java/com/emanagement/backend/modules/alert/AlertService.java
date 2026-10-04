package com.emanagement.backend.modules.alert;

import java.time.LocalDate;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.modules.alert.dto.AnomalyAlertResponseDto;
import com.emanagement.backend.modules.alert.dto.ResolveAlertRequestDto;

public interface AlertService {
    PageResponse<AnomalyAlertResponseDto> getAlerts(Boolean isResolved, LocalDate startDate, LocalDate endDate, Long shiftId, int page, int size);

    AnomalyAlertResponseDto resolveAlert(Long id, ResolveAlertRequestDto dto);

    void createAlert(AnomalyAlert alert);
}
