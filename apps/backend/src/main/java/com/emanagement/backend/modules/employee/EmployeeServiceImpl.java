package com.emanagement.backend.modules.employee;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.dto.PageResponse;
import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.common.service.EmailService;
import com.emanagement.backend.common.util.CodeGeneratorUtils;
import com.emanagement.backend.modules.auth.Role;
import com.emanagement.backend.modules.auth.RoleRepository;
import com.emanagement.backend.modules.employee.dto.EmployeeCreateDto;
import com.emanagement.backend.modules.employee.dto.EmployeeResponseDto;
import com.emanagement.backend.modules.employee.dto.EmployeeUpdateDto;
import com.emanagement.backend.modules.employee.dto.LiveEkycEnrollDto;
import com.emanagement.backend.modules.employee.dto.LiveEkycEnrollResponseDto;
import com.emanagement.backend.modules.face.AiFaceService;
import com.emanagement.backend.modules.face.FaceData;
import com.emanagement.backend.modules.face.FaceDataRepository;
import com.emanagement.backend.modules.face.dto.AiEnrollResponseDto;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final FaceDataRepository faceDataRepository;
    private final AiFaceService aiFaceService;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Override
    @Transactional
    public EmployeeResponseDto createEmployee(EmployeeCreateDto dto) {
        // 1. Bắt buộc hệ thống tự sinh mã nhân viên chuẩn doanh nghiệp: EMP + Năm(2 số) + 4 số STT (Ví dụ: EMP260001)
        String generatedEmployeeCode = CodeGeneratorUtils.generateEmployeeCode(
                code -> userRepository.findByEmployeeCode(code).isPresent());

        String email = (dto.getEmail() != null && !dto.getEmail().isBlank()) ? dto.getEmail().trim() : null;
        String phone = (dto.getPhone() != null && !dto.getPhone().isBlank()) ? dto.getPhone().trim() : null;

        // 2. Nếu có điền email, kiểm tra trùng lặp và kiểm tra DNS domain
        if (email != null) {
            if (userRepository.findByEmail(email).isPresent()) {
                throw new BusinessException("Email đã tồn tại trên hệ thống");
            }
            if (!emailService.verifyEmailDomainExists(email)) {
                throw new BusinessException("Tên miền của email (" + email + ") không tồn tại trên thực tế hoặc không thể nhận mail.");
            }
        }

        // 3. Nếu có điền số điện thoại, kiểm tra trùng lặp
        if (phone != null && userRepository.findByPhone(phone).isPresent()) {
            throw new BusinessException("Số điện thoại đã tồn tại trên hệ thống");
        }

        Role role = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(new Role(null, "ROLE_USER", "Nhân viên")));

        User user = User.builder()
                .employeeCode(generatedEmployeeCode)
                .fullName(dto.getFullName())
                .email(email)
                .phone(phone)
                .passwordHash(passwordEncoder.encode(dto.getPassword()))
                .status("ACTIVE")
                .roles(Set.of(role))
                .build();
        User created = userRepository.save(user);

        // 4. Nếu có email, tự động gửi thông báo chào mừng
        if (created.getEmail() != null && !created.getEmail().isBlank()) {
            try {
                emailService.sendWelcomeEmail(created.getEmail(), created.getFullName(), created.getEmployeeCode(), dto.getPassword());
            } catch (Exception e) {
                log.warn("Không thể gửi email chào mừng tới {}: {}", created.getEmail(), e.getMessage());
            }
        }

        return mapToDto(created);
    }

    @Override
    @Transactional
    public EmployeeResponseDto updateEmployee(Long id, EmployeeUpdateDto dto) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên với ID: " + id));

        user.setFullName(dto.getFullName());
        user.setPhone(dto.getPhone());
        if (dto.getStatus() != null) {
            user.setStatus(dto.getStatus());
        }

        User updated = userRepository.save(user);
        return mapToDto(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<EmployeeResponseDto> getAllEmployees(int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("id").descending());
        Page<User> usersPage = userRepository.findAll(pageRequest);

        List<EmployeeResponseDto> dtoList = usersPage.getContent().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return PageResponse.<EmployeeResponseDto>builder()
                .content(dtoList)
                .pageNumber(usersPage.getNumber())
                .pageSize(usersPage.getSize())
                .totalElement(usersPage.getTotalElements())
                .totalPages(usersPage.getTotalPages())
                .last(usersPage.isLast())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public EmployeeResponseDto getEmployeeById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên với ID: " + id));
        return mapToDto(user);
    }

    @Override
    @Transactional
    public void deleteEmployee(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên với ID: " + id));
        userRepository.delete(user);
    }

    @Override
    @Transactional
    public void deleteFaceData(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên với ID: " + id));
        faceDataRepository.deleteByUserId(user.getId());
    }

    @Override
    @Transactional
    public LiveEkycEnrollResponseDto enrollEkycLive(LiveEkycEnrollDto dto) {
        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên với ID: " + dto.getUserId()));

        // 1. Gọi AI CV Service để trích xuất vector khuôn mặt mẫu
        AiEnrollResponseDto enrollRes = aiFaceService.enrollFace(user.getId(), dto.getFaceImagesBase64());

        // 2. Xóa dữ liệu khuôn mặt cũ của nhân viên
        faceDataRepository.deleteByUserId(dto.getUserId());

        // 3. Lưu Vector mẫu 128 chiều mới vào PostgreSQL database
        FaceData faceData = FaceData.builder()
                .user(user)
                .faceVector(enrollRes.getEmbedding().toString())
                .imageSnapshotUrl(dto.getFaceImagesBase64() != null && !dto.getFaceImagesBase64().isEmpty() ? dto.getFaceImagesBase64().get(0) : null)
                .build();

        faceDataRepository.save(faceData);

        return LiveEkycEnrollResponseDto.builder()
                .userId(user.getId())
                .employeeCode(user.getEmployeeCode())
                .vectorCounterSaved(1)
                .message("Đăng ký dữ liệu khuôn mặt eKYC Live thành công cho nhân viên " + user.getFullName())
                .build();
    }

    private EmployeeResponseDto mapToDto(User user) {
        boolean hasFace = !faceDataRepository.findByUserId(user.getId()).isEmpty();
        Set<String> roleNames = user.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toSet());

        return EmployeeResponseDto.builder()
                .id(user.getId())
                .employeeCode(user.getEmployeeCode())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus())
                .roles(roleNames)
                .hasRegisteredFace(hasFace)
                .createdAt(user.getCreatedAt())
                .build();
    }
}
