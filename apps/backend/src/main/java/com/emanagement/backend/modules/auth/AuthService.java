package com.emanagement.backend.modules.auth;

import com.emanagement.backend.modules.auth.dto.*;

public interface AuthService {
    JwtResponse authenticateUser(LoginRequest loginRequest);

    void sendOtp(SendOtpRequest request);

    boolean verifyOtp(VerifyOtpRequest request);

    void resetPassword(ResetPasswordRequest request);

    UserProfileDto getCurrentUser(String identifier);

    UserProfileDto updateProfile(String currentIdentifier, UpdateProfileRequest request);

    void changePassword(String identifier, ChangePasswordRequest request);
}
