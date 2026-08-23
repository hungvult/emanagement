package com.emanagement.backend.modules.kiosk;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
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

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class KioskServiceImpl implements KioskService {
    private final KioskRepository kioskRepository;
    private final FaceDataRepository faceDataRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final ShiftRepository shiftRepository;
    private final AiFaceService aiFaceService;

    @Override
    @Transactional(readOnly = true)
    public Kiosk getKisokByToken(String deviceToken) {
        return kioskRepository.findByDeviceToken(deviceToken)
                .orElseThrow(() -> new ResourceNotFoundException("Xac thuc Kiosk that bai: Device Token khong hop le"));
    }

    @Override
    @Transactional
    public KioskCheckInResponseDto processCheckIn(String deviceToken, KioskCheckInRequestDto request) {
        Kiosk kiosk = getKisokByToken(deviceToken);

        String cleanBase64 = request.getImageFrameBase64() != null ? request.getImageFrameBase64().trim() : "";
        if (cleanBase64.contains(",")) {
            cleanBase64 = cleanBase64.split(",")[1];
        }
        cleanBase64 = cleanBase64.replaceAll("[^a-zA-Z0-9+/=]", "");
        byte[] frameBytes = Base64.getDecoder().decode(cleanBase64);

        List<Double> frameVector = aiFaceService.extractEmbedding(frameBytes);

        List<FaceData> allFaceData = faceDataRepository.findAll();
        if (allFaceData.isEmpty()) {
            throw new BusinessException("Chua co du lieu khuon mat nao duoc dang ky tren he thong");
        }

        List<List<Double>> registeredVectors = new ArrayList<>();
        for (FaceData face : allFaceData) {
            registeredVectors.add(parseVectorString(face.getFaceVector()));
        }

        AiMatchResult matchResult = aiFaceService.matchFace(frameVector, registeredVectors);
        if (!matchResult.matched() || matchResult.matchedIndex() < 0) {
            throw new BusinessException("Khong nhan dien duoc khuon mat. Vui long thu lai");
        }

        FaceData matchFaceData = allFaceData.get(matchResult.matchedIndex());
        User user = matchFaceData.getUser();

        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        List<AttendanceRecord> todayRecords = attendanceRecordRepository.findByUserIdAndCheckInTimeBetween(user.getId(),
                startOfDay, endOfDay);

        String checkType;
        String status = "ON_TIME";
        AttendanceRecord record;

        Shift defaulShift = shiftRepository.findByShiftCode("OFFICE_HOURS").orElse(null);
        LocalTime shiftStart = defaulShift != null ? defaulShift.getStartTime() : LocalTime.of(8, 0);
        int graceMinutes = defaulShift != null ? defaulShift.getGracePeriodMinutes() : 15;

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
            record.setSnapshotUrl(
                    "minio://attendance/checkin_" + user.getEmployeeCode() + "_" + System.currentTimeMillis() + ".jpg");
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
                .message((checkType.equals("CHECK_IN") ? "Check-in" : "Check-out") + " thanh cong cho nhan vien "
                        + user.getFullName())
                .build();
    }

    @Override
    @Transactional
    public Kiosk registerKiosk(KioskRegisterDto dto) {
        if (kioskRepository.findByKioskCode(dto.getKioskCode()).isPresent()) {
            throw new BusinessException("Ma tram Kiosk da ton tai");
        }

        Kiosk kiosk = Kiosk.builder()
                .kioskCode(dto.getKioskCode())
                .name(dto.getName())
                .deviceToken("kiosk_token_" + UUID.randomUUID().toString())
                .status("ACTIVE")
                .build();
        return kioskRepository.save(kiosk);
    }

    private List<Double> parseVectorString(String vectorStr) {
        List<Double> list = new ArrayList<>();
        if (vectorStr == null || vectorStr.isBlank())
            return list;
        String clean = vectorStr.replace("[", "").replace("]", "");
        if (clean.isEmpty())
            return list;

        String[] parts = clean.split(",");
        for (String p : parts) {
            try {
                list.add(Double.parseDouble(p.trim()));
            } catch (NumberFormatException e) {
            }
        }
        return list;
    }
}
