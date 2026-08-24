package com.emanagement.backend.common.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import javax.naming.directory.Attribute;
import javax.naming.directory.Attributes;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.net.InetAddress;
import java.util.Hashtable;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Override
    public void sendOtpEmail(String toEmail, String otpCode, String type) {
        log.info("[OTP EMAIL]: Email = {}, OTP = {}, Loai = {}", toEmail, otpCode, type);

        if (mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(toEmail);
                message.setSubject("Mã OTP Xác Thực E-Management: " + otpCode);
                message.setText("Mã OTP của bạn là: " + otpCode + ". Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này cho ai.");
                mailSender.send(message);
            } catch (Exception e) {
                log.error("Không thể gửi email qua SMTP server: {}", e.getMessage());
            }
        }
    }

    @Override
    public void sendWelcomeEmail(String toEmail, String fullName, String employeeCode, String rawPassword) {
        log.info("[WELCOME EMAIL]: Gửi thông tin tài khoản nhân viên mới tới email: {}", toEmail);

        if (mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(toEmail);
                message.setSubject("Chào Mừng Đến Với Hệ Thống E-Management - Thông Tin Tài Khoản");
                message.setText(String.format(
                        "Xin chào %s,\n\n" +
                        "Tài khoản của bạn đã được tạo thành công trên hệ thống eManagement.\n" +
                        "Thông tin đăng nhập của bạn:\n" +
                        "- Mã nhân viên: %s\n" +
                        "- Email đăng nhập: %s\n" +
                        "- Mật khẩu khởi tạo: %s\n\n" +
                        "Vui lòng đăng nhập và hoàn tất đăng ký dữ liệu khuôn mặt eKYC tại trạm Kiosk hoặc liên hệ quản trị viên.\n\n" +
                        "Trân trọng,\n" +
                        "Ban Quản Trị eManagement",
                        fullName, employeeCode, toEmail, rawPassword
                ));
                mailSender.send(message);
            } catch (Exception e) {
                log.error("Không thể gửi email chào mừng qua SMTP server: {}", e.getMessage());
            }
        }
    }

    @Override
    public boolean verifyEmailDomainExists(String email) {
        if (email == null || !email.contains("@")) {
            return false;
        }

        String domain = email.substring(email.indexOf("@") + 1).trim();

        // Cho phép các domain thử nghiệm nội bộ
        if (domain.equalsIgnoreCase("emanagement.com") || domain.equalsIgnoreCase("localhost") || domain.equalsIgnoreCase("test.com")) {
            return true;
        }

        try {
            // Kiểm tra MX Record (Mail Exchange Server) của Domain qua DNS
            Hashtable<String, String> env = new Hashtable<>();
            env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
            DirContext ictx = new InitialDirContext(env);
            Attributes attrs = ictx.getAttributes(domain, new String[]{"MX"});
            Attribute attr = attrs.get("MX");

            if (attr != null && attr.size() > 0) {
                return true;
            }

            // Fallback: Kiểm tra Host Address DNS resolution
            InetAddress address = InetAddress.getByName(domain);
            return address != null;
        } catch (Exception ex) {
            log.warn("Tên miền email [{}] không tồn tại trên hệ thống DNS toàn cầu", domain);
            return false;
        }
    }
}
