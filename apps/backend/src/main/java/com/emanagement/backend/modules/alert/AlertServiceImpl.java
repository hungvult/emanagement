package com.emanagement.backend.modules.alert;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.modules.alert.dto.AnomalyAlertResponseDto;
import com.emanagement.backend.modules.alert.dto.ResolveAlertRequestDto;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AlertServiceImpl implements AlertService {
    private final AnomalyAlertRepository anomalyAlertRepository;
    private final UserRepository userRepository;

    @Override
    public PageResponse<AnomalyAlertResponseDto> getAlerts(Boolean isResolved, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<AnomalyAlert> pageResult;
        if (isResolved != null) {
            pageResult = anomalyAlertRepository.findByIsResolvedOrderByCreatedAtDesc(isResolved, pageRequest);
        } else {
            pageResult = anomalyAlertRepository.findAll(pageRequest);
        }
        return PageResponse.from(pageResult.map(this::mapToDto));
    }

    @Override
    public AnomalyAlertResponseDto resolveAlert(Long id, ResolveAlertRequestDto dto) {
        AnomalyAlert alert = anomalyAlertRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay canh bao voi ID: " + id));
        User manager = userRepository.findById(dto.getResolvedByUserId()).orElseThrow(
                () -> new ResourceNotFoundException("Khong tim thay quan ly voi ID: " + dto.getResolvedByUserId()));

        alert.setIsResolved(true);
        alert.setResolvedBy(manager);

        AnomalyAlert updated = anomalyAlertRepository.save(alert);
        return mapToDto(updated);
    }

    private AnomalyAlertResponseDto mapToDto(AnomalyAlert alert) {
        return AnomalyAlertResponseDto.builder()
                .id(alert.getId())
                .userId(alert.getUser().getId())
                .employeeCode(alert.getUser().getEmployeeCode())
                .fullName(alert.getUser().getFullName())
                .alertType(alert.getAlertType())
                .alertDate(alert.getAlertDate())
                .desciption(alert.getDesciption())
                .isResolved(alert.getIsResolved())
                .resolvedByName(alert.getResolvedBy() != null ? alert.getResolvedBy().getFullName() : null)
                .createdAt(alert.getCreatedAt())
                .build();
    }
}
