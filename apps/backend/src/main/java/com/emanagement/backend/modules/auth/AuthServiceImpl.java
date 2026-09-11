package com.emanagement.backend.modules.auth;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.emanagement.backend.common.exception.BusinessException;
import com.emanagement.backend.common.exception.ResourceNotFoundException;
import com.emanagement.backend.common.service.EmailService;
import com.emanagement.backend.modules.auth.dto.*;
import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;
import com.emanagement.backend.security.JwtTokenProvider;
import com.emanagement.backend.security.UserPrincipal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final OtpCodeRepository otpCodeRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_DURATION_MINUTES = 15;
    private static final SecureRandom random = new SecureRandom();

    @Override
    @Transactional
    public JwtResponse authenticateUser(LoginRequest loginRequest) {
        String identifier = loginRequest.getIdentifier();

        // 1. Tìm người dùng bằng Mã nhân viên HOẶC Email HOẶC Số điện thoại
        User user = userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new BusinessException("Mã nhân viên, Email hoặc Số điện thoại không tồn tại trên hệ thống"));

        // 2. Kiểm tra tài khoản có đang bị khóa do nhập sai quá 5 lần hay không
        if (user.getAccountLockedUntil() != null && user.getAccountLockedUntil().isAfter(LocalDateTime.now())) {
            throw new BusinessException("Tài khoản tạm thời bị khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau.");
        }

        // 3. Kiểm tra mật khẩu
        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPasswordHash())) {
            int failed = (user.getFailedLoginAttempts() != null ? user.getFailedLoginAttempts() : 0) + 1;
            user.setFailedLoginAttempts(failed);
            if (failed >= MAX_FAILED_ATTEMPTS) {
                user.setAccountLockedUntil(LocalDateTime.now().plusMinutes(LOCK_DURATION_MINUTES));
                log.warn("Tài khoản {} bị khóa 15 phút do nhập sai mật khẩu 5 lần", identifier);
            }
            userRepository.save(user);

            int remaining = MAX_FAILED_ATTEMPTS - failed;
            if (remaining > 0) {
                throw new BusinessException("Mật khẩu không chính xác. Bạn còn " + remaining + " lần thử.");
            } else {
                throw new BusinessException("Tài khoản đã bị khóa 15 phút do nhập sai mật khẩu 5 lần liên tiếp.");
            }
        }

        // 4. Kiểm tra OTP nếu đăng nhập 2FA được yêu cầu
        if (loginRequest.getOtpCode() != null && !loginRequest.getOtpCode().isBlank()) {
            boolean otpValid = verifyOtpInternal(identifier, loginRequest.getOtpCode(), "LOGIN_2FA");
            if (!otpValid) {
                throw new BusinessException("Mã OTP xác thực 2FA không chính xác hoặc đã hết hạn.");
            }
        }

        // 5. Reset số lần đăng nhập sai nếu hợp lệ
        user.setFailedLoginAttempts(0);
        user.setAccountLockedUntil(null);
        userRepository.save(user);

        // 6. Thực hiện Authentication Spring Security (dùng employeeCode làm username chính để luôn có giá trị)
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(user.getEmployeeCode(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String jwt = jwtTokenProvider.genarateToken(authentication);

        UserPrincipal userPrincipal = (UserPrincipal) authentication.getPrincipal();
        Set<String> roles = userPrincipal.getAuthorities().stream()
                .map(item -> item.getAuthority())
                .collect(Collectors.toSet());

        return JwtResponse.builder()
                .accessToken(jwt)
                .tokenType("Bearer")
                .id(userPrincipal.getId())
                .employeeCode(userPrincipal.getEmployeeCode())
                .fullName(userPrincipal.getFullName())
                .email(userPrincipal.getEmail())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .roles(roles)
                .build();
    }

    @Override
    @Transactional
    public void sendOtp(SendOtpRequest request) {
        String identifier = request.getIdentifier();
        String type = request.getType();

        // Check if user exists (ngoại trừ trường hợp UPDATE_PROFILE gửi đến email/sđt mới)
        if (!"UPDATE_PROFILE".equals(type)) {
            userRepository.findByIdentifier(identifier)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với " + identifier));
        }

        // Generate 6-digit random code
        String otpCode = String.format("%06d", random.nextInt(1000000));

        OtpCode otp = OtpCode.builder()
                .identifier(identifier)
                .otpCode(otpCode)
                .type(type)
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .isUsed(false)
                .build();

        otpCodeRepository.save(otp);

        // Send OTP via Email or SMS
        if (identifier.contains("@")) {
            emailService.sendOtpEmail(identifier, otpCode, type);
        } else {
            log.info("📱 [MÃ OTP GỬI VỀ SỐ ĐIỆN THOẠI]: Phone = {}, OTP = {}, Loại = {}", identifier, otpCode, type);
        }
    }

    @Override
    @Transactional
    public boolean verifyOtp(VerifyOtpRequest request) {
        return verifyOtpInternal(request.getIdentifier(), request.getOtpCode(), request.getType());
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String identifier = request.getIdentifier();
        boolean validOtp = verifyOtpInternal(identifier, request.getOtpCode(), "RESET_PASSWORD");

        if (!validOtp) {
            throw new BusinessException("Mã OTP xác thực đổi mật khẩu không hợp lệ hoặc đã hết hạn.");
        }

        User user = userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với " + identifier));

        if (request.getNewPassword().length() < 8) {
            throw new BusinessException("Mật khẩu mới phải có tối thiểu 8 ký tự.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setFailedLoginAttempts(0);
        user.setAccountLockedUntil(null);
        userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileDto getCurrentUser(String identifier) {
        User user = userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin người dùng"));

        Set<String> roles = user.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toSet());

        return UserProfileDto.builder()
                .id(user.getId())
                .employeeCode(user.getEmployeeCode())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .roles(roles)
                .build();
    }

    @Override
    @Transactional
    public UserProfileDto updateProfile(String currentIdentifier, UpdateProfileRequest request) {
        User user = userRepository.findByIdentifier(currentIdentifier)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản người dùng hiện tại"));

        // Xác thực mã OTP gửi về Email mới hoặc Phone mới
        String targetIdentifier = (request.getEmail() != null && !request.getEmail().isBlank()) ? request.getEmail() : request.getPhone();
        if (targetIdentifier == null || targetIdentifier.isBlank()) {
            throw new BusinessException("Vui lòng cung cấp Email hoặc Số điện thoại mới để cập nhật");
        }

        boolean validOtp = verifyOtpInternal(targetIdentifier, request.getOtpCode(), "UPDATE_PROFILE");
        if (!validOtp) {
            throw new BusinessException("Mã OTP xác thực cập nhật thông tin cá nhân không chính xác hoặc đã hết hạn.");
        }

        // Cập nhật thông tin sau khi xác thực OTP thành công
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName());
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            Optional<User> existing = userRepository.findByEmail(request.getEmail());
            if (existing.isPresent() && !existing.get().getId().equals(user.getId())) {
                throw new BusinessException("Email này đã được sử dụng bởi một tài khoản khác.");
            }
            user.setEmail(request.getEmail());
            user.setIsEmailVerified(true);
        }

        if (request.getPhone() != null && !request.getPhone().isBlank()) {
            Optional<User> existing = userRepository.findByPhone(request.getPhone());
            if (existing.isPresent() && !existing.get().getId().equals(user.getId())) {
                throw new BusinessException("Số điện thoại này đã được sử dụng bởi một tài khoản khác.");
            }
            user.setPhone(request.getPhone());
            user.setIsPhoneVerified(true);
        }

        User updated = userRepository.save(user);

        Set<String> roles = updated.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toSet());

        return UserProfileDto.builder()
                .id(updated.getId())
                .employeeCode(updated.getEmployeeCode())
                .fullName(updated.getFullName())
                .email(updated.getEmail())
                .phone(updated.getPhone())
                .avatarUrl(updated.getAvatarUrl())
                .roles(roles)
                .build();
    }

    @Override
    @Transactional
    public void changePassword(String identifier, ChangePasswordRequest request) {
        User user = userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new BusinessException("Mật khẩu cũ không chính xác.");
        }

        if (request.getNewPassword().length() < 8) {
            throw new BusinessException("Mật khẩu mới phải có tối thiểu 8 ký tự.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    private boolean verifyOtpInternal(String identifier, String code, String type) {
        Optional<OtpCode> otpOpt = otpCodeRepository
                .findTopByIdentifierAndTypeAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
                        identifier, type, LocalDateTime.now());

        if (otpOpt.isPresent()) {
            OtpCode otp = otpOpt.get();
            if (otp.getOtpCode().equals(code)) {
                otp.setIsUsed(true);
                otpCodeRepository.save(otp);
                return true;
            }
        }
        return false;
    }
}
