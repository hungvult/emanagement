package com.emanagement.backend.modules.alert;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    @Transactional(readOnly = true)
    public PageResponse<AnomalyAlertResponseDto> getAlerts(Boolean isResolved, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<AnomalyAlert> alertPage;

        if (isResolved != null) {
            alertPage = anomalyAlertRepository.findByIsResolvedOrderByCreatedAtDesc(isResolved, pageRequest);
        } else {
            alertPage = anomalyAlertRepository.findAll(pageRequest);
        }
        return PageResponse.from(alertPage.map(this::mapToDto));
    }

    @Override
    @Transactional
    public AnomalyAlertResponseDto resolveAlert(Long id, ResolveAlertRequestDto dto) {
        AnomalyAlert alert = anomalyAlertRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cảnh báo với ID: " + id));

        User user = userRepository.findById(dto.getResolvedByUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy quản lý với ID: " + dto.getResolvedByUserId()));

        alert.setIsResolved(true);
        alert.setResolvedBy(user);
        AnomalyAlert updated = anomalyAlertRepository.save(alert);
        return mapToDto(updated);
    }

    private AnomalyAlertResponseDto mapToDto(AnomalyAlert alert) {
        return AnomalyAlertResponseDto.builder()
                .id(alert.getId())
                .userId(alert.getUser() != null ? alert.getUser().getId() : null)
                .employeeCode(alert.getUser() != null ? alert.getUser().getEmployeeCode() : "N/A")
                .fullName(alert.getUser() != null ? alert.getUser().getFullName() : "N/A")
                .alertType(alert.getAlertType())
                .alertDate(alert.getAlertDate())
                .description(alert.getDescription())
                .isResolved(alert.getIsResolved())
                .resolvedByName(alert.getResolvedBy() != null ? alert.getResolvedBy().getFullName() : null)
                .createdAt(alert.getCreatedAt())
                .build();
    }
}
