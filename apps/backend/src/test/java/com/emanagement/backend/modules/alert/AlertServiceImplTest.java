package com.emanagement.backend.modules.alert;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.alert.dto.AnomalyAlertResponseDto;
import com.emanagement.backend.modules.alert.dto.ResolveAlertRequestDto;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.shift.EmployeeShiftRepository;
import com.emanagement.backend.modules.shift.Shift;
import com.emanagement.backend.modules.shift.ShiftRepository;

@ExtendWith(MockitoExtension.class)
class AlertServiceImplTest {

    @Mock
    private AnomalyAlertRepository anomalyAlertRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmployeeShiftRepository employeeShiftRepository;

    @Mock
    private ShiftRepository shiftRepository;

    @Mock
    private StorageService storageService;

    @InjectMocks
    private AlertServiceImpl alertService;

    private AnomalyAlert alert;
    private User user;
    private User resolver;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L)
                .employeeCode("EMP001")
                .fullName("Nguyen Van A")
                .build();

        resolver = User.builder()
                .id(2L)
                .employeeCode("MGR001")
                .fullName("Tran Thi B")
                .build();

        alert = AnomalyAlert.builder()
                .id(100L)
                .user(user)
                .alertType("UNKNOWN_FACE")
                .alertDate(LocalDate.of(2026, 10, 23))
                .description("Cảnh báo UNKNOWN_FACE xuất hiện tại trạm Kiosk 1")
                .isResolved(false)
                .snapshotUrl("snapshots/2026/10/23/alert_unknown_face_123.jpg")
                .createdAt(LocalDateTime.of(2026, 10, 23, 8, 30))
                .build();
    }

    @Test
    @DisplayName("getAlerts maps presigned snapshot URL with 30 minutes duration")
    void getAlerts_ShouldMapPresignedSnapshotUrl() {
        Page<AnomalyAlert> page = new PageImpl<>(List.of(alert), PageRequest.of(0, 10), 1);
        when(shiftRepository.findByShiftCode("SHIFT-001")).thenReturn(Optional.empty());
        when(anomalyAlertRepository.findWithFilters(anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any()))
                .thenReturn(page);
        when(storageService.getPresignedUrl("snapshots/2026/10/23/alert_unknown_face_123.jpg", 30))
                .thenReturn("http://minio:9000/attendance-images/snapshots/2026/10/23/alert_unknown_face_123.jpg?X-Amz-Signature=abc");

        PageResponse<AnomalyAlertResponseDto> result = alertService.getAlerts(null, null, null, null, 0, 10);

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        AnomalyAlertResponseDto dto = result.getContent().get(0);
        assertEquals("http://minio:9000/attendance-images/snapshots/2026/10/23/alert_unknown_face_123.jpg?X-Amz-Signature=abc", dto.getSnapshotUrl());
        verify(storageService).getPresignedUrl("snapshots/2026/10/23/alert_unknown_face_123.jpg", 30);
    }

    @Test
    @DisplayName("getAlerts with null snapshotUrl maps to null presigned URL")
    void getAlerts_WithNullSnapshotUrl_ShouldMapToNull() {
        alert.setSnapshotUrl(null);
        Page<AnomalyAlert> page = new PageImpl<>(List.of(alert), PageRequest.of(0, 10), 1);
        when(shiftRepository.findByShiftCode("SHIFT-001")).thenReturn(Optional.empty());
        when(anomalyAlertRepository.findWithFilters(anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any()))
                .thenReturn(page);
        when(storageService.getPresignedUrl(null, 30)).thenReturn(null);

        PageResponse<AnomalyAlertResponseDto> result = alertService.getAlerts(null, null, null, null, 0, 10);

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        assertNull(result.getContent().get(0).getSnapshotUrl());
    }

    @Test
    @DisplayName("resolveAlert should mark alert as resolved and include presigned snapshot URL")
    void resolveAlert_ShouldResolveAndIncludeSnapshotUrl() {
        when(anomalyAlertRepository.findById(100L)).thenReturn(Optional.of(alert));
        when(userRepository.findById(2L)).thenReturn(Optional.of(resolver));
        when(anomalyAlertRepository.save(any(AnomalyAlert.class))).thenAnswer(inv -> inv.getArgument(0));
        when(storageService.getPresignedUrl("snapshots/2026/10/23/alert_unknown_face_123.jpg", 30))
                .thenReturn("http://minio:9000/attendance-images/snapshots/2026/10/23/alert_unknown_face_123.jpg?signed=true");

        ResolveAlertRequestDto req = new ResolveAlertRequestDto(2L);
        AnomalyAlertResponseDto res = alertService.resolveAlert(100L, req);

        assertNotNull(res);
        assertTrue(res.getIsResolved());
        assertEquals("Tran Thi B", res.getResolvedByName());
        assertEquals("http://minio:9000/attendance-images/snapshots/2026/10/23/alert_unknown_face_123.jpg?signed=true", res.getSnapshotUrl());
        verify(anomalyAlertRepository).save(alert);
    }

    @Test
    @DisplayName("resolveAlert with null snapshotUrl should resolve and map snapshotUrl to null")
    void resolveAlert_WithNullSnapshotUrl_ShouldResolveWithNullSnapshotUrl() {
        alert.setSnapshotUrl(null);
        when(anomalyAlertRepository.findById(100L)).thenReturn(Optional.of(alert));
        when(userRepository.findById(2L)).thenReturn(Optional.of(resolver));
        when(anomalyAlertRepository.save(any(AnomalyAlert.class))).thenAnswer(inv -> inv.getArgument(0));
        when(storageService.getPresignedUrl(null, 30)).thenReturn(null);

        ResolveAlertRequestDto req = new ResolveAlertRequestDto(2L);
        AnomalyAlertResponseDto res = alertService.resolveAlert(100L, req);

        assertNotNull(res);
        assertTrue(res.getIsResolved());
        assertEquals("Tran Thi B", res.getResolvedByName());
        assertNull(res.getSnapshotUrl());
        verify(anomalyAlertRepository).save(alert);
    }

    @Test
    @DisplayName("createAlert saves anomaly alert entity")
    void createAlert_ShouldSaveAlert() {
        alertService.createAlert(alert);
        verify(anomalyAlertRepository).save(alert);
    }

    @Test
    @DisplayName("getUnresolvedAlertCount returns count from anomalyAlertRepository")
    void getUnresolvedAlertCount_ShouldReturnCount() {
        when(anomalyAlertRepository.countByIsResolvedFalse()).thenReturn(12L);

        long count = alertService.getUnresolvedAlertCount();

        assertEquals(12L, count);
        verify(anomalyAlertRepository).countByIsResolvedFalse();
    }

    @Test
    @DisplayName("getUnresolvedAlertCount returns 0 when no unresolved alerts")
    void getUnresolvedAlertCount_WhenNoUnresolved_ShouldReturnZero() {
        when(anomalyAlertRepository.countByIsResolvedFalse()).thenReturn(0L);

        long count = alertService.getUnresolvedAlertCount();

        assertEquals(0L, count);
        verify(anomalyAlertRepository).countByIsResolvedFalse();
    }

    @Test
    @DisplayName("AlertController.getUnresolvedAlertCount returns ApiResponse with unresolved count")
    void alertController_getUnresolvedAlertCount_ShouldReturnCount() {
        AlertService mockService = mock(AlertService.class);
        AlertController controller = new AlertController(mockService);
        when(mockService.getUnresolvedAlertCount()).thenReturn(9L);

        ResponseEntity<ApiResponse<Long>> response = controller.getUnresolvedAlertCount();

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("SUCCESS", response.getBody().getStatus());
        assertEquals(9L, response.getBody().getData());
        verify(mockService).getUnresolvedAlertCount();
    }

    @Test
    @DisplayName("getUnresolvedAlertCount returns large count value correctly without overflow")
    void getUnresolvedAlertCount_WhenLargeCount_ShouldReturnCorrectValue() {
        long largeCount = 1_000_000L;
        when(anomalyAlertRepository.countByIsResolvedFalse()).thenReturn(largeCount);

        long count = alertService.getUnresolvedAlertCount();

        assertEquals(largeCount, count);
        verify(anomalyAlertRepository).countByIsResolvedFalse();
    }
}
