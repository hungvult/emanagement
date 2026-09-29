package com.emanagement.backend.modules.shift;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.common.util.CodeGeneratorUtils;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.notification.NotificationService;
import com.emanagement.backend.modules.notification.NotificationType;
import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.EmployeeShiftResponseDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;
import java.util.Optional;

import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShiftServiceImpl implements ShiftService {
        private final ShiftRepository shiftRepository;
        private final EmployeeShiftRepository employeeShiftRepository;
        private final UserRepository userRepository;
        private final NotificationService notificationService;

        private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

        @Override
        @Transactional
        public void assignShift(AssignShiftDto dto) {
                User user = userRepository.findById(dto.getUserId())
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy nhân viên với ID: " + dto.getUserId()));
                Shift shift = shiftRepository.findById(dto.getShiftId())
                                .orElseThrow(
                                                () -> new ResourceNotFoundException(
                                                                "Không tìm thấy ca làm việc với ID: "
                                                                                + dto.getShiftId()));

                // Tìm xem nhân viên này đã có ca vào ngày đó chưa
                Optional<EmployeeShift> existing = employeeShiftRepository
                                .findByUserIdAndAssignedDate(dto.getUserId(), dto.getAssignedDate());

                // Ca cũ (null nếu đây là lần phân ca đầu tiên cho ngày này)
                Shift previousShift = existing.map(EmployeeShift::getShift).orElse(null);

                // Phân lại đúng ca cũ thì không có gì thay đổi: không lưu, không thông báo
                if (previousShift != null && previousShift.getId().equals(shift.getId())) {
                        return;
                }

                EmployeeShift employeeShift = existing.orElseGet(EmployeeShift::new);
                employeeShift.setUser(user);
                employeeShift.setShift(shift);
                employeeShift.setAssignedDate(dto.getAssignedDate());
                EmployeeShift saved = employeeShiftRepository.save(employeeShift);

                // Soạn nội dung thông báo
                String dateText = dto.getAssignedDate().format(DATE_FMT);
                String timeText = shift.getStartTime().format(TIME_FMT) + " - " + shift.getEndTime().format(TIME_FMT);

                if (previousShift == null) {
                        // Trường hợp 1: phân ca mới
                        notificationService.notifyUser(user, NotificationType.SHIFT_ASSIGNED,
                                        "Bạn được phân ca làm việc",
                                        shift.getName() + " (" + timeText + ") vào ngày " + dateText + ".",
                                        saved.getId());
                } else {
                        // Trường hợp 2: đổi từ ca này sang ca khác
                        notificationService.notifyUser(user, NotificationType.SHIFT_CHANGED,
                                        "Ca làm việc của bạn đã thay đổi",
                                        "Lịch ngày " + dateText + " đã đổi từ " + previousShift.getName()
                                                        + " sang " + shift.getName() + " (" + timeText + ").",
                                        saved.getId());
                }
        }

        @Override
        @Transactional
        public ShiftResponseDto createShift(ShiftCreateDto dto) {
                String generatedShiftCode = CodeGeneratorUtils.generateShiftCode(
                                code -> shiftRepository.findByShiftCode(code).isPresent());

                Shift shift = new Shift();
                shift.setShiftCode(generatedShiftCode);
                shift.setName(dto.getName());
                shift.setStartTime(dto.getStartTime());
                shift.setEndTime(dto.getEndTime());
                shift.setGracePeriodMinutes(dto.getGracePeriodMinutes() != null ? dto.getGracePeriodMinutes() : 15);

                Shift saved = shiftRepository.save(shift);
                return mapToDto(saved);
        }

        @Override
        @Transactional(readOnly = true)
        public List<ShiftResponseDto> getAllShifts() {
                return shiftRepository.findAll().stream()
                                .map(this::mapToDto)
                                .collect(Collectors.toList());
        }

        private EmployeeShiftResponseDto mapToEmployeeShiftDto(EmployeeShift es) {
                return EmployeeShiftResponseDto.builder()
                                .id(es.getId())
                                .userId(es.getUser().getId())
                                .employeeCode(es.getUser().getEmployeeCode())
                                .fullName(es.getUser().getFullName())
                                .shiftId(es.getShift().getId())
                                .shiftName(es.getShift().getName())
                                .shiftCode(es.getShift().getShiftCode())
                                .startTime(es.getShift().getStartTime())
                                .endTime(es.getShift().getEndTime())
                                .assignedDate(es.getAssignedDate())
                                .build();
        }

        @Override
        @Transactional(readOnly = true)
        public List<EmployeeShiftResponseDto> getSchedule(LocalDate startDate, LocalDate endDate) {
                return employeeShiftRepository
                                .findByAssignedDateBetweenOrderByAssignedDateAsc(startDate, endDate)
                                .stream()
                                .map(this::mapToEmployeeShiftDto)
                                .collect(Collectors.toList());
        }

        @Override
        @Transactional(readOnly = true)
        public List<EmployeeShiftResponseDto> getMySchedule(Long userId, LocalDate startDate, LocalDate endDate) {
                if (endDate.isBefore(startDate)) {
                        throw new BusinessException("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
                }
                if (ChronoUnit.DAYS.between(startDate, endDate) > 92) {
                        throw new BusinessException("Chỉ được xem lịch tối đa 93 ngày mỗi lần");
                }
                return employeeShiftRepository
                                .findByUserIdAndAssignedDateBetweenOrderByAssignedDateAsc(userId, startDate, endDate)
                                .stream()
                                .map(this::mapToEmployeeShiftDto)
                                .collect(Collectors.toList());
        }

        private ShiftResponseDto mapToDto(Shift shift) {
                return ShiftResponseDto.builder()
                                .id(shift.getId())
                                .shiftCode(shift.getShiftCode())
                                .name(shift.getName())
                                .startTime(shift.getStartTime())
                                .endTime(shift.getEndTime())
                                .gracePeriodMinutes(shift.getGracePeriodMinutes())
                                .build();
        }

        @Override
        @Transactional
        public void removeAssignedShift(Long userId, String assignedDate) {
                LocalDate date = LocalDate.parse(assignedDate);
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy nhân viên với ID: " + userId));

                EmployeeShift employeeShift = employeeShiftRepository
                                .findByUserIdAndAssignedDate(userId, date)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Nhân viên này không có ca làm việc vào ngày " + date.format(DATE_FMT)));

                String shiftName = employeeShift.getShift().getName();
                String dateText = date.format(DATE_FMT);

                employeeShiftRepository.delete(employeeShift);

                // Gửi thông báo cho nhân viên
                notificationService.notifyUser(user, NotificationType.SHIFT_REMOVED,
                                "Ca làm việc đã bị hủy",
                                shiftName + " vào ngày " + dateText + " đã bị hủy bởi quản trị viên.",
                                null);
        }
}
