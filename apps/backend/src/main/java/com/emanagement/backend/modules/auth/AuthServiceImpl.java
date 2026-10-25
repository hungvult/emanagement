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

import com.emanagement.backend.common.service.StorageService;

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
    private final RefreshTokenService refreshTokenService;
    private final StorageService storageService;

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

        // 2. Kiểm tra trạng thái tài khoản (ACTIVE, INACTIVE, LOCKED,...)
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new BusinessException("Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ quản trị viên.");
        }

        // 3. Kiểm tra tài khoản có đang bị tạm khóa do nhập sai mật khẩu quá 5 lần
        if (user.getAccountLockedUntil() != null) {
            if (user.getAccountLockedUntil().isAfter(LocalDateTime.now())) {
                throw new BusinessException("Tài khoản tạm thời bị khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau.");
            } else {
                user.setAccountLockedUntil(null);
                user.setFailedLoginAttempts(0);
                userRepository.save(user);
            }
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
        String jwt = jwtTokenProvider.generateToken(authentication);
        String refreshToken = refreshTokenService.createRefreshToken(user);

        UserPrincipal userPrincipal = (UserPrincipal) authentication.getPrincipal();
        Set<String> roles = userPrincipal.getAuthorities().stream()
                .map(item -> item.getAuthority())
                .collect(Collectors.toSet());

        return JwtResponse.builder()
                .accessToken(jwt)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .id(userPrincipal.getId())
                .employeeCode(userPrincipal.getEmployeeCode())
                .fullName(userPrincipal.getFullName())
                .email(userPrincipal.getEmail())
                .phone(user.getPhone())
                .avatarUrl(storageService.getPresignedUrl(user.getAvatarUrl(), 60))
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
            User user = userRepository.findByIdentifier(identifier)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với " + identifier));
            if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
                throw new BusinessException("Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.");
            }
            if (user.getAccountLockedUntil() != null && user.getAccountLockedUntil().isAfter(LocalDateTime.now())) {
                throw new BusinessException("Tài khoản đang bị tạm khóa. Vui lòng thử lại sau.");
            }
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
        String targetEmail = identifier;
        if (!identifier.contains("@")) {
            Optional<User> userOpt = userRepository.findByIdentifier(identifier);
            if (userOpt.isEmpty()) {
                userOpt = userRepository.findByEmployeeCode(identifier);
            }
            if (userOpt.isPresent() && userOpt.get().getEmail() != null && !userOpt.get().getEmail().isBlank()) {
                targetEmail = userOpt.get().getEmail();
            }
        }

        if (targetEmail != null && targetEmail.contains("@")) {
            emailService.sendOtpEmail(targetEmail, otpCode, type);
            log.info("📧 [OTP_SENT] Đã gửi mã xác thực tới: {}, Loại: {}", maskIdentifier(targetEmail), type);
        } else {
            log.info("📱 [OTP_SENT] Đã gửi mã xác thực tới: {}, Loại: {}", maskIdentifier(targetEmail), type);
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

        User user = userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng với " + identifier));

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new BusinessException("Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.");
        }

        boolean validOtp = verifyOtpInternal(identifier, request.getOtpCode(), "RESET_PASSWORD");
        if (!validOtp) {
            throw new BusinessException("Mã OTP xác thực đổi mật khẩu không hợp lệ hoặc đã hết hạn.");
        }

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
                .avatarUrl(storageService.getPresignedUrl(user.getAvatarUrl(), 60))
                .roles(roles)
                .build();
    }

    @Override
    @Transactional
    public UserProfileDto updateProfile(String currentIdentifier, UpdateProfileRequest request) {
        User user = userRepository.findByIdentifier(currentIdentifier)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản người dùng hiện tại"));

        boolean emailChanged = request.getEmail() != null && !request.getEmail().isBlank()
                && !request.getEmail().equalsIgnoreCase(user.getEmail());
        boolean phoneChanged = request.getPhone() != null && !request.getPhone().isBlank()
                && !request.getPhone().equals(user.getPhone());

        // Chỉ xác thực OTP khi người dùng thay đổi Email hoặc Số điện thoại
        if (emailChanged || phoneChanged) {
            if (request.getOtpCode() == null || request.getOtpCode().isBlank()) {
                throw new BusinessException("Vui lòng cung cấp mã OTP để xác nhận thay đổi Email hoặc Số điện thoại.");
            }
            String targetIdentifier = emailChanged ? request.getEmail().trim() : request.getPhone().trim();
            boolean validOtp = verifyOtpInternal(targetIdentifier, request.getOtpCode().trim(), "UPDATE_PROFILE");
            if (!validOtp) {
                throw new BusinessException("Mã OTP xác thực cập nhật thông tin cá nhân không chính xác hoặc đã hết hạn.");
            }
        }

        // Cập nhật họ và tên
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }

        // Cập nhật Email nếu có thay đổi
        if (emailChanged) {
            String newEmail = request.getEmail().trim();
            Optional<User> existing = userRepository.findByEmail(newEmail);
            if (existing.isPresent() && !existing.get().getId().equals(user.getId())) {
                throw new BusinessException("Email này đã được sử dụng bởi một tài khoản khác.");
            }
            user.setEmail(newEmail);
            user.setIsEmailVerified(true);
        }

        // Cập nhật Số điện thoại nếu có thay đổi
        if (phoneChanged) {
            String newPhone = request.getPhone().trim();
            Optional<User> existing = userRepository.findByPhone(newPhone);
            if (existing.isPresent() && !existing.get().getId().equals(user.getId())) {
                throw new BusinessException("Số điện thoại này đã được sử dụng bởi một tài khoản khác.");
            }
            user.setPhone(newPhone);
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
                .avatarUrl(storageService.getPresignedUrl(updated.getAvatarUrl(), 60))
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

    @Override
    @Transactional
    public TokenRefreshResponse refreshToken(RefreshTokenRequest request) {
        RefreshToken verifiedToken = refreshTokenService.verifyAndGet(request.getRefreshToken());
        User user = verifiedToken.getUser();

        // 1. Kiểm tra trạng thái tài khoản
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            refreshTokenService.revokeToken(request.getRefreshToken());
            throw new BusinessException("Tài khoản của bạn đã bị vô hiệu hóa hoặc không hoạt động.");
        }

        // 2. Kiểm tra khóa tài khoản
        if (user.getAccountLockedUntil() != null && user.getAccountLockedUntil().isAfter(LocalDateTime.now())) {
            refreshTokenService.revokeToken(request.getRefreshToken());
            throw new BusinessException("Tài khoản đang bị tạm khóa. Vui lòng thử lại sau.");
        }

        UserPrincipal userPrincipal = UserPrincipal.create(user);
        Authentication authentication = new UsernamePasswordAuthenticationToken(userPrincipal, null, userPrincipal.getAuthorities());
        String newAccessToken = jwtTokenProvider.generateToken(authentication);

        String newRefreshToken = refreshTokenService.rotateRefreshToken(verifiedToken);

        return TokenRefreshResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .build();
    }

    @Override
    @Transactional
    public void logout(String refreshToken) {
        refreshTokenService.revokeToken(refreshToken);
    }

    private String maskIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return "***";
        }
        if (identifier.contains("@")) {
            String[] parts = identifier.split("@", 2);
            String name = parts[0];
            String domain = parts.length > 1 ? parts[1] : "";
            if (name.length() <= 2) {
                return name.charAt(0) + "***@" + domain;
            }
            return name.charAt(0) + "***" + name.charAt(name.length() - 1) + "@" + domain;
        } else {
            if (identifier.length() <= 4) {
                return "***";
            }
            return identifier.substring(0, 2) + "***" + identifier.substring(identifier.length() - 2);
        }
    }
}
