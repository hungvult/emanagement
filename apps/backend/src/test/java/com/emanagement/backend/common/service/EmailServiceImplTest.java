package com.emanagement.backend.common.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class EmailServiceImplTest {

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private EmailServiceImpl emailService;

    @Test
    @DisplayName("Gửi OTP qua email: Subject không chứa mã OTP")
    void sendOtpEmail_SubjectDoesNotContainOtpCode() {
        ReflectionTestUtils.setField(emailService, "fromEmail", "noreply@emanagement.com");

        emailService.sendOtpEmail("test@example.com", "654321", "UPDATE_PROFILE");

        ArgumentCaptor<SimpleMailMessage> messageCaptor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(messageCaptor.capture());

        SimpleMailMessage sentMessage = messageCaptor.getValue();
        assertEquals("Mã OTP Xác Thực E-Management", sentMessage.getSubject());
        assertFalse(sentMessage.getSubject().contains("654321"));
        assertNotNull(sentMessage.getText());
        assertTrue(sentMessage.getText().contains("654321"));
    }
}
