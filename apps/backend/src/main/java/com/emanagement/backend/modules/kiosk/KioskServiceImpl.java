package com.emanagement.backend.modules.kiosk;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.common.util.CodeGeneratorUtils;
import com.emanagement.backend.modules.alert.AnomalyAlert;
import com.emanagement.backend.modules.alert.AnomalyAlertRepository;
import com.emanagement.backend.modules.attendance.AttendanceRecord;
import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.face.AiFaceService;
import com.emanagement.backend.modules.face.AiMatchResult;
import com.emanagement.backend.modules.face.FaceData;
import com.emanagement.backend.modules.face.FaceDataRepository;
import com.emanagement.backend.modules.kiosk.dto.KioskCheckInRequestDto;
import com.emanagement.backend.modules.kiosk.dto.KioskCheckInResponseDto;
import com.emanagement.backend.modules.kiosk.dto.KioskRegisterDto;
import com.emanagement.backend.modules.shift.Shift;
import com.emanagement.backend.modules.shift.ShiftRepository;
import com.emanagement.backend.security.JwtTokenProvider;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
public class KioskServiceImpl implements KioskService {

    private final KioskRepository kioskRepository;
    private final FaceDataRepository faceDataRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final ShiftRepository shiftRepository;
    private final AiFaceService aiFaceService;
    private final AnomalyAlertRepository anomalyAlertRepository;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    @Transactional
    public KioskCheckInResponseDto processCheckIn(String deviceToken, KioskCheckInRequestDto requestDto) {
        Kiosk kiosk = getKioskByToken(deviceToken);

        String cleanBase64 = requestDto.getImageFrameBase64() != null ? requestDto.getImageFrameBase64().trim() : "";
        if (cleanBase64.contains(",")) {
            cleanBase64 = cleanBase64.split(",")[1];
        }
        cleanBase64 = cleanBase64.replaceAll("[^a-zA-Z0-9+/=]", "");
        byte[] frameBytes = Base64.getDecoder().decode(cleanBase64);

        List<Double> frameVector = aiFaceService.extractEmbedding(frameBytes);

        List<FaceData> allFaceData = faceDataRepository.findAll();
        if (allFaceData.isEmpty()) {
            throw new BusinessException("Chưa có dữ liệu khuôn mặt nào được đăng ký trên hệ thống");
        }

        List<List<Double>> registeredVectors = new ArrayList<>();
        for (FaceData face : allFaceData) {
            registeredVectors.add(parseVectorString(face.getFaceVector()));
        }

        AiMatchResult matchResult = aiFaceService.matchFace(frameVector, registeredVectors);
        if (!matchResult.matched() || matchResult.matchedIndex() < 0) {
            // Tự động tạo cảnh báo khuôn mặt lạ
            AnomalyAlert alert = new AnomalyAlert();
            alert.setUser(null);
            alert.setAlertType("UNKNOWN_FACE");
            alert.setAlertDate(LocalDate.now());
            alert.setDescription("Khuôn mặt lạ xuất hiện tại trạm " + kiosk.getName());
            alert.setIsResolved(false);
            anomalyAlertRepository.save(alert);

            throw new BusinessException("Không nhận diện được khuôn mặt. Vui lòng thử lại");
        }

        FaceData matchedFaceData = allFaceData.get(matchResult.matchedIndex());
        User user = matchedFaceData.getUser();

        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        List<AttendanceRecord> todayRecords = attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(
                user.getId(), startOfDay, endOfDay);

        String checkType;
        String status = "ON_TIME";
        AttendanceRecord record;

        Shift defaultShift = shiftRepository.findByShiftCode("SHIFT-001").orElse(null);
        LocalTime shiftStart = defaultShift != null ? defaultShift.getStartTime() : LocalTime.of(8, 0);
        int graceMinutes = defaultShift != null ? defaultShift.getGracePeriodMinutes() : 15;

        if (todayRecords.isEmpty()) {
            checkType = "CHECK_IN";
            LocalTime nowTime = now.toLocalTime();
            if (nowTime.isAfter(shiftStart.plusMinutes(graceMinutes))) {
                status = "LATE";
            }

            record = new AttendanceRecord();
            record.setUser(user);
            record.setKiosk(kiosk);
            record.setCheckInTime(now);
            record.setStatus(status);
            record.setSnapshotUrl("minio://attendance/checkin_" + user.getEmployeeCode() + "_" + System.currentTimeMillis() + ".jpg");
        } else {
            checkType = "CHECK_OUT";
            record = todayRecords.get(todayRecords.size() - 1);
            record.setCheckOutTime(now);
            status = record.getStatus();
        }

        attendanceRecordRepository.save(record);

        return KioskCheckInResponseDto.builder()
                .userId(user.getId())
                .employeeCode(user.getEmployeeCode())
                .fullName(user.getFullName())
                .checkType(checkType)
                .checkTime(now)
                .attendanceStatus(status)
                .confidence(matchResult.confidence())
                .message((checkType.equals("CHECK_IN") ? "Check-in" : "Check-out") + " thành công cho nhân viên " + user.getFullName())
                .build();
    }

    @Override
    @Transactional
    public Kiosk registerKiosk(KioskRegisterDto dto) {
        // 1. Tự sinh mã trạm Kiosk: KSK- NămTháng - 3 số STT (Ví dụ: KSK-2608-001)
        String generatedKioskCode = CodeGeneratorUtils.generateKioskCode(
                code -> kioskRepository.findByKioskCode(code).isPresent());

        // 2. Tự sinh Device Token bảo mật chuẩn JWT có chữ ký số HMAC-SHA256
        String signedDeviceToken = jwtTokenProvider.generateKioskDeviceToken(generatedKioskCode, dto.getName());

        Kiosk kiosk = new Kiosk();
        kiosk.setKioskCode(generatedKioskCode);
        kiosk.setName(dto.getName());
        kiosk.setDeviceToken(signedDeviceToken);
        kiosk.setStatus("ACTIVE");

        return kioskRepository.save(kiosk);
    }

    @Override
    @Transactional(readOnly = true)
    public Kiosk getKioskByToken(String deviceToken) {
        if (deviceToken == null || deviceToken.isBlank()) {
            throw new ResourceNotFoundException("Thiếu Device Token xác thực trạm Kiosk (X-Kiosk-Token header)");
        }

        // Kiểm tra tính toàn vẹn và hợp lệ của chữ ký số JWT
        if (!jwtTokenProvider.validateToken(deviceToken)) {
            throw new ResourceNotFoundException("Xác thực Kiosk thất bại: Chữ ký số JWT Device Token không hợp lệ hoặc đã bị chỉnh sửa");
        }

        return kioskRepository.findByDeviceToken(deviceToken)
                .orElseThrow(() -> new ResourceNotFoundException("Xác thực Kiosk thất bại: Trạm Kiosk không tồn tại trên hệ thống"));
    }

    private List<Double> parseVectorString(String vectorStr) {
        List<Double> list = new ArrayList<>();
        if (vectorStr == null || vectorStr.isBlank()) return list;
        String clean = vectorStr.replace("[", "").replace("]", "").trim();
        if (clean.isEmpty()) return list;

        String[] parts = clean.split(",");
        for (String p : parts) {
            try {
                list.add(Double.parseDouble(p.trim()));
            } catch (NumberFormatException ignored) {}
        }
        return list;
    }
}
