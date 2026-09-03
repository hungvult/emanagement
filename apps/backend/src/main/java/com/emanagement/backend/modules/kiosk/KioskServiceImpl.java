package com.emanagement.backend.modules.kiosk;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.common.util.CodeGeneratorUtils;
import com.emanagement.backend.modules.alert.AnomalyAlert;
import com.emanagement.backend.modules.alert.AnomalyAlertRepository;
import com.emanagement.backend.modules.attendance.AttendanceRecord;
import com.emanagement.backend.modules.attendance.AttendanceRecordRepository;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.face.AiFaceService;
import com.emanagement.backend.modules.face.FaceData;
import com.emanagement.backend.modules.face.FaceDataRepository;
import com.emanagement.backend.modules.face.dto.AiCandidateDto;
import com.emanagement.backend.modules.face.dto.AiRecognizeResponseDto;
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
import java.util.List;

@Service
@RequiredArgsConstructor
public class KioskServiceImpl implements KioskService {

    private final KioskRepository kioskRepository;
    private final FaceDataRepository faceDataRepository;
    private final UserRepository userRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final ShiftRepository shiftRepository;
    private final AiFaceService aiFaceService;
    private final com.emanagement.backend.modules.alert.AlertService alertService;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    @Transactional
    public KioskCheckInResponseDto processCheckIn(String deviceToken, KioskCheckInRequestDto requestDto) {
        Kiosk kiosk = getKioskByToken(deviceToken);

        String cleanBase64 = requestDto.getImageFrameBase64() != null ? requestDto.getImageFrameBase64().trim() : "";

        // 1. Tải danh sách tất cả các nhân viên đã đăng ký khuôn mặt trên hệ thống
        List<FaceData> allFaceData = faceDataRepository.findAll();
        if (allFaceData.isEmpty()) {
            throw new BusinessException("Chưa có dữ liệu khuôn mặt nào được đăng ký trên hệ thống");
        }

        List<AiCandidateDto> candidates = new ArrayList<>();
        for (FaceData face : allFaceData) {
            List<Double> vec = parseVectorString(face.getFaceVector());
            if (!vec.isEmpty() && face.getUser() != null) {
                candidates.add(new AiCandidateDto(face.getUser().getId(), vec));
            }
        }

        // 2. Gọi AI CV Service để kiểm tra khung hình và thực hiện nhận diện
        AiRecognizeResponseDto recognizeRes = aiFaceService.recognizeFace(cleanBase64, candidates);

        // 3. Xử lý các mã CvStatus từ AI Service
        if (!recognizeRes.isMatched() || recognizeRes.getMatchedUserId() == null) {
            String status = recognizeRes.getStatus() != null ? recognizeRes.getStatus() : "UNKNOWN_FACE";
            
            if ("UNKNOWN_FACE".equals(status) || "AMBIGUOUS_MATCH".equals(status) || "SPOOF_DETECTED".equals(status)) {
                // Tự động tạo cảnh báo bất thường trong cơ sở dữ liệu
                AnomalyAlert alert = new AnomalyAlert();
                alert.setUser(null);
                alert.setAlertType(status);
                alert.setAlertDate(LocalDate.now());
                alert.setDescription("Cảnh báo " + status + " xuất hiện tại trạm " + kiosk.getName());
                alert.setIsResolved(false);
                alertService.createAlert(alert);

                String msg = "SPOOF_DETECTED".equals(status) 
                        ? "Phát hiện giả mạo khuôn mặt. Hành vi bất thường đã được hệ thống ghi nhận!"
                        : ("UNKNOWN_FACE".equals(status)
                                ? "Không nhận diện được khuôn mặt nhân viên trong danh sách ca làm việc."
                                : "Phát hiện tranh chấp nhận diện (kết quả các ứng viên quá giống nhau).");
                throw new BusinessException(msg);
            } else if ("NO_FACE".equals(status)) {
                throw new BusinessException("Không phát hiện khuôn mặt trong vùng camera.");
            } else if ("MULTIPLE_FACES".equals(status)) {
                throw new BusinessException("Phát hiện nhiều khuôn mặt trong vùng camera. Chỉ chấp nhận 1 người.");
            } else if ("IMAGE_TOO_BLURRY".equals(status)) {
                throw new BusinessException("Hình ảnh bị mờ. Vui lòng giữ yên hoặc kiểm tra ống kính camera.");
            } else if ("IMAGE_TOO_DARK".equals(status)) {
                throw new BusinessException("Môi trường quá tối. Vui lòng điều chỉnh ánh sáng.");
            } else if ("FACE_NOT_CENTERED".equals(status)) {
                throw new BusinessException("Khuôn mặt nằm ngoài vùng quét hợp lệ. Vui lòng di chuyển vào giữa.");
            } else if ("FACE_POSE_INVALID".equals(status)) {
                throw new BusinessException("Góc nghiêng khuôn mặt không hợp lệ. Vui lòng nhìn thẳng vào camera.");
            } else if ("FACE_TOO_SMALL".equals(status)) {
                throw new BusinessException("Khuôn mặt quá nhỏ. Vui lòng tiến lại gần camera.");
            } else {
                throw new BusinessException("Lỗi xử lý hình ảnh camera (" + status + "). Vui lòng thử lại.");
            }
        }

        // 4. Nhận diện thành công -> Tìm thông tin nhân viên
        Long matchedUserId = recognizeRes.getMatchedUserId();
        User user = userRepository.findById(matchedUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin nhân viên ID: " + matchedUserId));

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
            record.setSnapshotUrl(cleanBase64);
        } else {
            record = todayRecords.get(todayRecords.size() - 1);
            
            if (record.getCheckOutTime() != null) {
                throw new BusinessException("Bạn đã hoàn thành việc chấm công hôm nay (vào & ra ca). Không thể chấm công thêm.");
            }
            
            // Tránh trường hợp vừa check-in xong đứng nán lại bị máy tự quét nhầm thành check-out
            if (record.getCheckInTime() != null && java.time.Duration.between(record.getCheckInTime(), now).toMinutes() < 1) {
                throw new BusinessException("Bạn vừa mới chấm công vào ca thành công! Vui lòng quay lại sau để chấm công ra ca.");
            }

            checkType = "CHECK_OUT";
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
                .confidence(recognizeRes.getSimilarityScore() * 100.0)
                .message((checkType.equals("CHECK_IN") ? "Check-in" : "Check-out") + " thành công cho nhân viên " + user.getFullName())
                .build();
    }

    @Override
    @Transactional
    public Kiosk registerKiosk(KioskRegisterDto dto) {
        String generatedKioskCode = CodeGeneratorUtils.generateKioskCode(
                code -> kioskRepository.findByKioskCode(code).isPresent());

        String signedDeviceToken = jwtTokenProvider.generateKioskDeviceToken(generatedKioskCode, dto.getName());

        Kiosk kiosk = new Kiosk();
        kiosk.setKioskCode(generatedKioskCode);
        kiosk.setName(dto.getName());
        kiosk.setDeviceToken(signedDeviceToken);
        kiosk.setStatus("ACTIVE");

        return kioskRepository.save(kiosk);
    }

    @Override
    @Transactional
    public Kiosk getKioskByToken(String deviceToken) {
        if (deviceToken != null && !deviceToken.isBlank() && !"WEB_KIOSK_DEFAULT".equals(deviceToken)) {
            if (jwtTokenProvider.validateToken(deviceToken)) {
                return kioskRepository.findByDeviceToken(deviceToken)
                        .orElseThrow(() -> new ResourceNotFoundException("Xác thực Kiosk thất bại: Trạm Kiosk không tồn tại trên hệ thống"));
            }
        }

        // Fallback: Tìm hoặc tạo Kiosk mặc định cho Web Homepage Check-in
        return kioskRepository.findAll().stream().findFirst().orElseGet(() -> {
            Kiosk defaultKiosk = new Kiosk();
            defaultKiosk.setKioskCode("KIOSK-MAIN");
            defaultKiosk.setName("Trạm Chấm Công Trụ Sở Chính");
            defaultKiosk.setDeviceToken("WEB_KIOSK_DEFAULT");
            defaultKiosk.setStatus("ACTIVE");
            return kioskRepository.save(defaultKiosk);
        });
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
