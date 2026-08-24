package com.emanagement.backend.modules.shift;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.common.util.CodeGeneratorUtils;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;

import lombok.RequiredArgsConstructor;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShiftServiceImpl implements ShiftService {
    private final ShiftRepository shiftRepository;
    private final EmployeeShiftRepository employeeShiftRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public void assignShift(AssignShiftDto dto) {
        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên với ID: " + dto.getUserId()));
        Shift shift = shiftRepository.findById(dto.getShiftId())
                .orElseThrow(
                        () -> new ResourceNotFoundException("Không tìm thấy ca làm việc với ID: " + dto.getShiftId()));

        EmployeeShift employeeShift = employeeShiftRepository
                .findByUserIdAndAssignedDate(dto.getUserId(), dto.getAssignedDate())
                .orElseGet(EmployeeShift::new);

        employeeShift.setUser(user);
        employeeShift.setShift(shift);
        employeeShift.setAssignedDate(dto.getAssignedDate());

        employeeShiftRepository.save(employeeShift);
    }

    @Override
    @Transactional
    public ShiftResponseDto createShift(ShiftCreateDto dto) {
        // Bắt buộc hệ thống tự sinh mã ca làm việc: SHIFT- 3 số STT (Ví dụ: SHIFT-001, SHIFT-002)
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
}
