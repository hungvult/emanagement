package com.emanagement.backend.common.exception;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Collections;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import com.emanagement.backend.common.dto.ApiResponse;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler exceptionHandler;

    @BeforeEach
    void setUp() {
        exceptionHandler = new GlobalExceptionHandler();
    }

    @Test
    void handleResourceNotFoundException_Returns404() {
        ResourceNotFoundException ex = new ResourceNotFoundException("User not found");
        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleResourceNotFoundException(ex);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("ERROR", response.getBody().getStatus());
        assertEquals("User not found", response.getBody().getMessage());
        assertNull(response.getBody().getData());
    }

    @Test
    void handleBusinessException_Returns400() {
        BusinessException ex = new BusinessException("Business logic error");
        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleBusinessException(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("ERROR", response.getBody().getStatus());
        assertEquals("Business logic error", response.getBody().getMessage());
    }

    @Test
    void handleHttpMessageNotReadableException_Returns400() {
        HttpMessageNotReadableException ex = new HttpMessageNotReadableException("Malformed JSON", (org.springframework.http.HttpInputMessage) null);
        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleHttpMessageNotReadableException(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("ERROR", response.getBody().getStatus());
        assertTrue(response.getBody().getMessage().contains("Dữ liệu yêu cầu không hợp lệ"));
    }

    @Test
    void handleMethodArgumentTypeMismatchException_Returns400() {
        MethodParameter methodParam = mock(MethodParameter.class);
        MethodArgumentTypeMismatchException ex = new MethodArgumentTypeMismatchException(
                "invalid", Boolean.class, "includeInactive", methodParam, new IllegalArgumentException());

        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleMethodArgumentTypeMismatchException(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("ERROR", response.getBody().getStatus());
        assertTrue(response.getBody().getMessage().contains("includeInactive"));
        assertTrue(response.getBody().getMessage().contains("Boolean"));
    }

    @Test
    void handleMissingServletRequestParameterException_Returns400() {
        MissingServletRequestParameterException ex = new MissingServletRequestParameterException("page", "int");
        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleMissingServletRequestParameterException(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().getMessage().contains("page"));
    }

    @Test
    void handleMissingRequestHeaderException_Returns400() {
        MethodParameter param = mock(MethodParameter.class);
        MissingRequestHeaderException ex = new MissingRequestHeaderException("X-Device-Id", param);
        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleMissingRequestHeaderException(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().getMessage().contains("X-Device-Id"));
    }

    @Test
    void handleConstraintViolationException_Returns400WithErrors() {
        ConstraintViolation<?> violation = mock(ConstraintViolation.class);
        Path path = mock(Path.class);
        when(path.toString()).thenReturn("id");
        when(violation.getPropertyPath()).thenReturn(path);
        when(violation.getMessage()).thenReturn("must be greater than 0");

        ConstraintViolationException ex = new ConstraintViolationException(Set.of(violation));
        ResponseEntity<ApiResponse<Map<String, String>>> response = exceptionHandler.handleConstraintViolationException(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("VALIDATION_ERROR", response.getBody().getStatus());
        assertEquals("must be greater than 0", response.getBody().getData().get("id"));
    }

    @Test
    void handleAccessDeniedException_Returns403() {
        AccessDeniedException ex = new AccessDeniedException("Access denied");
        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleAccessDeniedException(ex);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("ERROR", response.getBody().getStatus());
        assertEquals("Bạn không có quyền thực hiện thao tác này", response.getBody().getMessage());
    }

    @Test
    void handleHttpRequestMethodNotSupportedException_Returns405() {
        HttpRequestMethodNotSupportedException ex = new HttpRequestMethodNotSupportedException("PATCH");
        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleHttpRequestMethodNotSupportedException(ex);

        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().getMessage().contains("PATCH"));
    }

    @Test
    void handleHttpMediaTypeNotSupportedException_Returns415() {
        HttpMediaTypeNotSupportedException ex = new HttpMediaTypeNotSupportedException("application/xml");
        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleHttpMediaTypeNotSupportedException(ex);

        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().getMessage().contains("Content-Type"));
    }

    @Test
    void handleIllegalArgumentException_Returns400() {
        IllegalArgumentException ex = new IllegalArgumentException("Invalid argument value");
        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleIllegalArgumentException(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Invalid argument value", response.getBody().getMessage());
    }

    @Test
    void handleGlobalException_Returns500WithoutLeakingStacktrace() {
        NullPointerException ex = new NullPointerException("Secret database connection error");
        ResponseEntity<ApiResponse<Object>> response = exceptionHandler.handleGlobalException(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Lỗi hệ thống nội bộ, vui lòng thử lại sau", response.getBody().getMessage());
        assertFalse(response.getBody().getMessage().contains("Secret database"));
    }
}
