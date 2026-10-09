package com.emanagement.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;


import com.emanagement.backend.security.CustomJwtAuthenticationEntryPoint;
import com.emanagement.backend.security.JwtAuthenticationFilter;

import lombok.RequiredArgsConstructor;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@Profile("!dev")
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CustomJwtAuthenticationEntryPoint customEntryPoint;

    /**
     * Extra origins to allow in addition to the self-derived origin.
     * Defaults to localhost patterns only — no need to hardcode tunnel URLs.
     * The self-origin (derived from X-Forwarded-Host + X-Forwarded-Proto) is
     * always added dynamically per-request.
     */
    @Value("${CORS_ALLOWED_ORIGINS:http://localhost:[*],http://127.0.0.1:[*]}")
    private String corsAllowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(c -> c.configurationSource(corsConfigurationSource()))
                .exceptionHandling(ex -> ex.authenticationEntryPoint(customEntryPoint))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/api/v1/auth/**", "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**",
                                "/h2-console/**")
                        .permitAll()
                        .requestMatchers("/api/v1/kiosks/**").permitAll()
                        .requestMatchers("/api/v1/shifts/my-schedule").authenticated()
                        .requestMatchers("/api/v1/dashboard/**").hasAuthority("ROLE_ADMIN")
                        .requestMatchers("/api/v1/employees/**", "/api/v1/shifts/**", "/api/v1/alerts/**")
                        .hasAuthority("ROLE_ADMIN")
                        .anyRequest().authenticated())
                .headers(headers -> headers.frameOptions(frame -> frame.disable()));

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
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
        // Parse static extra origins from env (e.g. localhost dev origins)
        List<String> staticOrigins = (corsAllowedOrigins == null || corsAllowedOrigins.isBlank())
                ? List.of("http://localhost:[*]", "http://127.0.0.1:[*]")
                : Arrays.stream(corsAllowedOrigins.split(","))
                        .map(String::trim)
                        .filter(o -> !o.isEmpty())
                        .toList();

        return request -> {
            // Derive the self-origin from forwarded headers provided by Nginx.
            // When behind Nginx: X-Forwarded-Host = public hostname, X-Forwarded-Proto = https.
            String forwardedHost = request.getHeader("X-Forwarded-Host");
            if (forwardedHost == null || forwardedHost.isBlank()) {
                forwardedHost = request.getHeader("Host");
            }
            String forwardedProto = request.getHeader("X-Forwarded-Proto");

            List<String> allowedPatterns = new ArrayList<>(staticOrigins);

            if (forwardedHost != null && !forwardedHost.isBlank()) {
                // Strip port if bundled in header (e.g. "example.com:443" -> "example.com")
                String host = forwardedHost.split(",")[0].trim();
                String proto = (forwardedProto != null && !forwardedProto.isBlank())
                        ? forwardedProto.split(",")[0].trim()
                        : "https";
                allowedPatterns.add(proto + "://" + host);
            }

            CorsConfiguration config = new CorsConfiguration();
            config.setAllowedOriginPatterns(allowedPatterns);
            config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
            config.setAllowedHeaders(List.of("*"));
            config.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
            config.setAllowCredentials(true);
            config.setMaxAge(3600L);
            return config;
        };
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration)
            throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
