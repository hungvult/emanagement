package com.emanagement.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@Profile("dev")
public class DevSecurityConfig {

    /**
     * Extra origins to allow in addition to the self-derived origin.
     * The self-origin (derived from X-Forwarded-Host + X-Forwarded-Proto) is
     * always added dynamically per-request.
     */
    @Value("${CORS_ALLOWED_ORIGINS:http://localhost:[*],http://127.0.0.1:[*]}")
    private String corsAllowedOrigins;

    @Bean
    public SecurityFilterChain devSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/**", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**",
                                "/h2-console/**")
                        .permitAll()
                        .anyRequest().permitAll())
                .headers(headers -> headers.frameOptions(frame -> frame.disable()));

        return http.build();
    }

    /**
     * Dynamic CORS source: per request, derives the public self-origin from
     * X-Forwarded-Host and X-Forwarded-Proto headers set by Nginx.
     * This automatically allows any reverse-proxy domain (tunnel, VPS, CDN)
     * without restarting the backend or editing any configuration.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        List<String> staticOrigins = (corsAllowedOrigins == null || corsAllowedOrigins.isBlank())
                ? List.of("http://localhost:[*]", "http://127.0.0.1:[*]")
                : Arrays.stream(corsAllowedOrigins.split(","))
                        .map(String::trim)
                        .filter(o -> !o.isEmpty())
                        .toList();

        return request -> {
            String forwardedHost = request.getHeader("X-Forwarded-Host");
            if (forwardedHost == null || forwardedHost.isBlank()) {
                forwardedHost = request.getHeader("Host");
            }
            String forwardedProto = request.getHeader("X-Forwarded-Proto");

            List<String> allowedPatterns = new ArrayList<>(staticOrigins);

            if (forwardedHost != null && !forwardedHost.isBlank()) {
                String host = forwardedHost.split(",")[0].trim();
                String proto = (forwardedProto != null && !forwardedProto.isBlank())
                        ? forwardedProto.split(",")[0].trim()
                        : "https";
                allowedPatterns.add(proto + "://" + host);
            }

            CorsConfiguration config = new CorsConfiguration();
            config.setAllowedOriginPatterns(allowedPatterns);
            config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
            config.setAllowedHeaders(Arrays.asList("*"));
            config.setExposedHeaders(Arrays.asList("Authorization", "Content-Disposition"));
            config.setAllowCredentials(true);
            config.setMaxAge(3600L);
            return config;
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration authConfig)
            throws Exception {
        return authConfig.getAuthenticationManager();
    }
}
