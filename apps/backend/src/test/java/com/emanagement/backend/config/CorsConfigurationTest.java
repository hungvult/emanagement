package com.emanagement.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CorsConfigurationTest {

    /**
     * Simulates the dynamic CorsConfigurationSource logic used in SecurityConfig and DevSecurityConfig:
     * derives the self-origin from X-Forwarded-Host (or Host fallback) + X-Forwarded-Proto per request.
     */
    private CorsConfiguration buildConfigForRequest(String forwardedHost, String hostHeader, String forwardedProto) {
        List<String> staticOrigins = List.of("http://localhost:[*]", "http://127.0.0.1:[*]");
        List<String> allowedPatterns = new ArrayList<>(staticOrigins);

        String effectiveHost = (forwardedHost != null && !forwardedHost.isBlank()) ? forwardedHost : hostHeader;

        if (effectiveHost != null && !effectiveHost.isBlank()) {
            String host = effectiveHost.split(",")[0].trim();
            String proto = (forwardedProto != null && !forwardedProto.isBlank())
                    ? forwardedProto.split(",")[0].trim()
                    : "https";
            allowedPatterns.add(proto + "://" + host);
        }

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(allowedPatterns);
        return config;
    }

    @Test
    void testLocalhostOriginsAlwaysAllowed() {
        CorsConfiguration config = buildConfigForRequest(null, null, null);
        assertEquals("http://localhost:3000", config.checkOrigin("http://localhost:3000"));
        assertEquals("http://127.0.0.1:8080", config.checkOrigin("http://127.0.0.1:8080"));
    }

    @Test
    void testSelfOriginDerivedFromForwardedHeaders_trycloudflare() {
        // Cloudflare Quick Tunnel: every random subdomain is automatically allowed
        CorsConfiguration config = buildConfigForRequest(
                "roger-tour-blair-john.trycloudflare.com", null, "https");

        assertEquals("https://roger-tour-blair-john.trycloudflare.com",
                config.checkOrigin("https://roger-tour-blair-john.trycloudflare.com"));

        // A different tunnel URL is NOT in this request's config (correct: no wildcard)
        assertNull(config.checkOrigin("https://digital-weeks-socket-trust.trycloudflare.com"));
    }

    @Test
    void testFallbackToHostHeaderWhenForwardedHostMissing() {
        // Fallback when Nginx or direct client provides Host instead of X-Forwarded-Host
        CorsConfiguration config = buildConfigForRequest(
                null, "tunnel-demo.trycloudflare.com", "https");

        assertEquals("https://tunnel-demo.trycloudflare.com",
                config.checkOrigin("https://tunnel-demo.trycloudflare.com"));
    }

    @Test
    void testSelfOriginDerivedFromForwardedHeaders_customDomain() {
        // Production VPS with a real domain behind Nginx
        CorsConfiguration config = buildConfigForRequest("emanagement.example.com", null, "https");

        assertEquals("https://emanagement.example.com",
                config.checkOrigin("https://emanagement.example.com"));
        assertNull(config.checkOrigin("https://evil.com"));
    }

    @Test
    void testNoForwardedHeaders_onlyStaticOriginsAllowed() {
        // Direct HTTP (no reverse proxy): only localhost is allowed
        CorsConfiguration config = buildConfigForRequest(null, null, null);

        assertEquals("http://localhost:3000", config.checkOrigin("http://localhost:3000"));
        assertNull(config.checkOrigin("https://someotherdomain.com"));
    }

    @Test
    void testMultipleForwardedHostValues_usesFirst() {
        // X-Forwarded-Host can contain comma-separated list; only first is trusted
        CorsConfiguration config = buildConfigForRequest(
                "trusted.example.com, evil.com", null, "https");

        assertEquals("https://trusted.example.com",
                config.checkOrigin("https://trusted.example.com"));
        assertNull(config.checkOrigin("https://evil.com"));
    }
}
