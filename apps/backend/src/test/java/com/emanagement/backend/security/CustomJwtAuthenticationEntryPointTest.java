package com.emanagement.backend.security;

import static org.junit.jupiter.api.Assertions.*;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

class CustomJwtAuthenticationEntryPointTest {

    private CustomJwtAuthenticationEntryPoint entryPoint;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        entryPoint = new CustomJwtAuthenticationEntryPoint(objectMapper);
    }

    @Test
    void commence_WritesUnauthorizedJsonResponseWithIsoTimestamp() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        entryPoint.commence(request, response, new BadCredentialsException("Bad token"));

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentType().startsWith("application/json"));
        assertEquals(StandardCharsets.UTF_8.name(), response.getCharacterEncoding());

        String content = response.getContentAsString(StandardCharsets.UTF_8);
        JsonNode root = objectMapper.readTree(content);

        assertEquals("ERROR", root.get("status").asText());
        assertEquals("Xác thực thất bại: Token hết hạn hoặc không hợp lệ", root.get("message").asText());
        assertTrue(root.get("data").isNull());
        // Verify timestamp is a text string (RFC 3339 / ISO-8601), not an integer array!
        assertTrue(root.get("timestamp").isTextual(), "Timestamp should be a textual ISO-8601 string");
    }
}
