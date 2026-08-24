package com.emanagement.backend.common.service;

public interface EmailService {
    void sendOtpEmail(String toEmail, String otpCode, String type);

    void sendWelcomeEmail(String toEmail, String fullName, String employeeCode, String rawPassword);

    boolean verifyEmailDomainExists(String email);
}
