package com.emanagement.backend.modules.shift;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.emanagement.backend.common.dto.ApiResponse;
import com.emanagement.backend.modules.shift.dto.AssignShiftDto;
import com.emanagement.backend.modules.shift.dto.ShiftCreateDto;
import com.emanagement.backend.modules.shift.dto.ShiftResponseDto;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/shifts")
@RequiredArgsConstructor
public class ShiftController {
    private final ShiftServiceImpl shiftServiceImpl;

    @PostMapping
    public ResponseEntity<ApiResponse<ShiftResponseDto>> createShift(@Valid @RequestBody ShiftCreateDto dto) {
        ShiftResponseDto response = shiftServiceImpl.createShift(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tao moi ca lam viec thanh cong", response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ShiftResponseDto>>> getAllShifts() {
        List<ShiftResponseDto> response = shiftServiceImpl.getAllShifts();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/assign")
    public ResponseEntity<ApiResponse<Void>> assignShift(@Valid @RequestBody AssignShiftDto dto) {
        shiftServiceImpl.assignShift(dto);
        return ResponseEntity.ok(ApiResponse.success("Phan ca thanh cong cho nhan vien", null));
    }
}
