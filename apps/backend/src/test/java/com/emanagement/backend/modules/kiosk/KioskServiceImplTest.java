package com.emanagement.backend.modules.kiosk;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.service.StorageService;
import com.emanagement.backend.modules.alert.AlertService;
import com.emanagement.backend.modules.alert.AnomalyAlert;
import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.face.AiFaceService;
import com.emanagement.backend.modules.face.FaceData;
import com.emanagement.backend.modules.face.FaceDataRepository;
import com.emanagement.backend.modules.face.dto.AiRecognizeResponseDto;
import com.emanagement.backend.modules.kiosk.dto.KioskCheckInRequestDto;
import com.emanagement.backend.modules.shift.EmployeeShiftRepository;
import com.emanagement.backend.modules.shift.ShiftRepository;
import com.emanagement.backend.security.JwtTokenProvider;

@ExtendWith(MockitoExtension.class)
class KioskServiceImplTest {

    @Mock
    private KioskRepository kioskRepository;

    @Mock
    private FaceDataRepository faceDataRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AttendanceRecordRepository attendanceRecordRepository;

    @Mock
    private ShiftRepository shiftRepository;

    @Mock
    private EmployeeShiftRepository employeeShiftRepository;

    @Mock
    private AiFaceService aiFaceService;

    @Mock
    private AlertService alertService;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private StorageService storageService;

    @InjectMocks
    private KioskServiceImpl kioskService;

    private Kiosk kiosk;
    private FaceData faceData;

    @BeforeEach
    void setUp() {
        kiosk = new Kiosk();
        kiosk.setId(1L);
        kiosk.setKioskCode("KIOSK-01");
        kiosk.setName("Trụ sở Kiosk A");
        kiosk.setDeviceToken("test-token");
        kiosk.setStatus("ACTIVE");

        User user = User.builder().id(10L).employeeCode("EMP010").build();
        faceData = FaceData.builder()
                .id(1L)
                .user(user)
                .faceVector("[0.12, -0.34, 0.56]")
                .build();
    }

    private void setupKioskAndFaceData() {
        when(jwtTokenProvider.validateToken("test-token")).thenReturn(true);
        when(kioskRepository.findByDeviceToken("test-token")).thenReturn(Optional.of(kiosk));
        when(faceDataRepository.findAll()).thenReturn(List.of(faceData));
    }

    @Test
    @DisplayName("processCheckIn uploads snapshot and creates AnomalyAlert on UNKNOWN_FACE")
    void processCheckIn_UnknownFace_ShouldUploadSnapshotAndCreateAlert() {
        setupKioskAndFaceData();
        String frameBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
        AiRecognizeResponseDto aiResponse = new AiRecognizeResponseDto(false, null, 0.0, "UNKNOWN_FACE");
        when(aiFaceService.recognizeFace(eq(frameBase64), anyList())).thenReturn(aiResponse);
        when(storageService.uploadBase64Image(frameBase64, StorageService.FOLDER_SNAPSHOTS, "alert_unknown_face"))
                .thenReturn("snapshots/2026/10/23/alert_unknown_face_uuid.jpg");

        KioskCheckInRequestDto req = new KioskCheckInRequestDto(frameBase64);
        BusinessException ex = assertThrows(BusinessException.class, () ->
                kioskService.processCheckIn("test-token", req));

        assertTrue(ex.getMessage().contains("Không nhận diện được khuôn mặt nhân viên"));

        ArgumentCaptor<AnomalyAlert> alertCaptor = ArgumentCaptor.forClass(AnomalyAlert.class);
        verify(alertService).createAlert(alertCaptor.capture());
        AnomalyAlert savedAlert = alertCaptor.getValue();
        assertEquals("UNKNOWN_FACE", savedAlert.getAlertType());
        assertEquals(LocalDate.now(), savedAlert.getAlertDate());
        assertEquals("snapshots/2026/10/23/alert_unknown_face_uuid.jpg", savedAlert.getSnapshotUrl());
        assertFalse(savedAlert.getIsResolved());
        verify(storageService).uploadBase64Image(frameBase64, StorageService.FOLDER_SNAPSHOTS, "alert_unknown_face");
    }

    @Test
    @DisplayName("processCheckIn uploads snapshot and creates AnomalyAlert on SPOOF_DETECTED")
    void processCheckIn_SpoofDetected_ShouldUploadSnapshotAndCreateAlert() {
        setupKioskAndFaceData();
        String frameBase64 = "base64-spoof-frame";
        AiRecognizeResponseDto aiResponse = new AiRecognizeResponseDto(false, null, 0.0, "SPOOF_DETECTED");
        when(aiFaceService.recognizeFace(eq(frameBase64), anyList())).thenReturn(aiResponse);
        when(storageService.uploadBase64Image(frameBase64, StorageService.FOLDER_SNAPSHOTS, "alert_spoof_detected"))
                .thenReturn("snapshots/2026/10/23/alert_spoof_detected_uuid.jpg");

        KioskCheckInRequestDto req = new KioskCheckInRequestDto(frameBase64);
        BusinessException ex = assertThrows(BusinessException.class, () ->
                kioskService.processCheckIn("test-token", req));

        assertTrue(ex.getMessage().contains("Phát hiện giả mạo"));

        ArgumentCaptor<AnomalyAlert> alertCaptor = ArgumentCaptor.forClass(AnomalyAlert.class);
        verify(alertService).createAlert(alertCaptor.capture());
        AnomalyAlert savedAlert = alertCaptor.getValue();
        assertEquals("SPOOF_DETECTED", savedAlert.getAlertType());
        assertEquals("snapshots/2026/10/23/alert_spoof_detected_uuid.jpg", savedAlert.getSnapshotUrl());
    }

    @Test
    @DisplayName("processCheckIn uploads snapshot and creates AnomalyAlert on AMBIGUOUS_MATCH")
    void processCheckIn_AmbiguousMatch_ShouldUploadSnapshotAndCreateAlert() {
        setupKioskAndFaceData();
        String frameBase64 = "base64-ambiguous-frame";
        AiRecognizeResponseDto aiResponse = new AiRecognizeResponseDto(false, null, 0.0, "AMBIGUOUS_MATCH");
        when(aiFaceService.recognizeFace(eq(frameBase64), anyList())).thenReturn(aiResponse);
        when(storageService.uploadBase64Image(frameBase64, StorageService.FOLDER_SNAPSHOTS, "alert_ambiguous_match"))
                .thenReturn("snapshots/2026/10/23/alert_ambiguous_match_uuid.jpg");

        KioskCheckInRequestDto req = new KioskCheckInRequestDto(frameBase64);
        BusinessException ex = assertThrows(BusinessException.class, () ->
                kioskService.processCheckIn("test-token", req));

        assertTrue(ex.getMessage().contains("tranh chấp nhận diện"));

        ArgumentCaptor<AnomalyAlert> alertCaptor = ArgumentCaptor.forClass(AnomalyAlert.class);
        verify(alertService).createAlert(alertCaptor.capture());
        AnomalyAlert savedAlert = alertCaptor.getValue();
        assertEquals("AMBIGUOUS_MATCH", savedAlert.getAlertType());
        assertEquals("snapshots/2026/10/23/alert_ambiguous_match_uuid.jpg", savedAlert.getSnapshotUrl());
    }

    @Test
    @DisplayName("processCheckIn gracefully catches upload failure and still creates AnomalyAlert")
    void processCheckIn_UploadFails_ShouldStillCreateAlert() {
        setupKioskAndFaceData();
        String frameBase64 = "base64-frame";
        AiRecognizeResponseDto aiResponse = new AiRecognizeResponseDto(false, null, 0.0, "UNKNOWN_FACE");
        when(aiFaceService.recognizeFace(eq(frameBase64), anyList())).thenReturn(aiResponse);
        when(storageService.uploadBase64Image(eq(frameBase64), anyString(), anyString()))
                .thenThrow(new RuntimeException("MinIO connection timed out"));

        KioskCheckInRequestDto req = new KioskCheckInRequestDto(frameBase64);
        assertThrows(BusinessException.class, () -> kioskService.processCheckIn("test-token", req));

        ArgumentCaptor<AnomalyAlert> alertCaptor = ArgumentCaptor.forClass(AnomalyAlert.class);
        verify(alertService).createAlert(alertCaptor.capture());
        AnomalyAlert savedAlert = alertCaptor.getValue();
        assertEquals("UNKNOWN_FACE", savedAlert.getAlertType());
        assertNull(savedAlert.getSnapshotUrl()); // Alert created even when upload fails
    }

    @Test
    @DisplayName("processCheckIn does not create AnomalyAlert for non-anomaly CV status like NO_FACE")
    void processCheckIn_NoFace_ShouldNotCreateAlert() {
        setupKioskAndFaceData();
        String frameBase64 = "base64-no-face";
        AiRecognizeResponseDto aiResponse = new AiRecognizeResponseDto(false, null, 0.0, "NO_FACE");
        when(aiFaceService.recognizeFace(eq(frameBase64), anyList())).thenReturn(aiResponse);

        KioskCheckInRequestDto req = new KioskCheckInRequestDto(frameBase64);
        BusinessException ex = assertThrows(BusinessException.class, () ->
                kioskService.processCheckIn("test-token", req));

        assertTrue(ex.getMessage().contains("Không phát hiện khuôn mặt"));
        verifyNoInteractions(storageService);
        verifyNoInteractions(alertService);
    }

    @Test
    @DisplayName("processCheckIn with null or blank base64 creates AnomalyAlert without upload attempt")
    void processCheckIn_BlankBase64_ShouldCreateAlertWithoutUpload() {
        setupKioskAndFaceData();
        AiRecognizeResponseDto aiResponse = new AiRecognizeResponseDto(false, null, 0.0, "UNKNOWN_FACE");
        when(aiFaceService.recognizeFace(eq(""), anyList())).thenReturn(aiResponse);

        KioskCheckInRequestDto req = new KioskCheckInRequestDto(null);
        assertThrows(BusinessException.class, () -> kioskService.processCheckIn("test-token", req));

        ArgumentCaptor<AnomalyAlert> alertCaptor = ArgumentCaptor.forClass(AnomalyAlert.class);
        verify(alertService).createAlert(alertCaptor.capture());
        AnomalyAlert savedAlert = alertCaptor.getValue();
        assertEquals("UNKNOWN_FACE", savedAlert.getAlertType());
        assertNull(savedAlert.getSnapshotUrl());
        verifyNoInteractions(storageService);
    }
}
