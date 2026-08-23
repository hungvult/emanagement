package com.emanagement.backend.modules.shift;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ShiftServiceImpl implements ShiftService {
    private final UserRepository userRepository;
    private final ShiftRepository shiftRepository;
    private final EmployeeShiftRepository employeeShiftRepository;

    @Override
    @Transactional
    public void assignShift(AssignShiftDto dto) {
        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Khong tim thay nhan vien voi ID " + dto.getUserId()));
        Shift shift = shiftRepository.findById(dto.getShiftId())
                .orElseThrow(
                        () -> new ResourceNotFoundException("Khong tim thay ca lam viec voi ID: " + dto.getShiftId()));

        EmployeeShift employeeShift = employeeShiftRepository
                .findByUserIdAndAssignedDate(dto.getUserId(), dto.getAssignedDate()).orElseGet(EmployeeShift::new);

        employeeShift.setUser(user);
        employeeShift.setShift(shift);
        employeeShift.setAssignedDate(dto.getAssignedDate());

        employeeShiftRepository.save(employeeShift);
    }

    @Override
    @Transactional
    public ShiftResponseDto createShift(ShiftCreateDto dto) {
        if (shiftRepository.findByShiftCode(dto.getShiftCode()).isPresent()) {
            throw new BusinessException("Ma ca lam viec da ton tai");
        }

        Shift shift = new Shift();
        shift.setShiftCode(dto.getShiftCode());
        shift.setName(dto.getName());
        shift.setStartTime(dto.getStartTime());
        shift.setEndTime(dto.getEndTime());
        shift.setGracePeriodMinutes(dto.getGracePeriodMinutes() != null ? dto.getGracePeriodMinutes() : 15);

        Shift created = shiftRepository.save(shift);
        return mapToDto(created);
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
