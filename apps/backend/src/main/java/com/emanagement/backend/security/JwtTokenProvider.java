package com.emanagement.backend.security;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

@Component
public class JwtTokenProvider {
    @Value("${jwt.secret:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}")
    private String jwtSecret;

    @Value("${jwt.expiration-ms:86400000}")
    private Long jwtExpirationMs;

    private Key getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String genarateToken(Authentication authentication) {
        UserPrincipal userPrincipal = (UserPrincipal) authentication.getPrincipal();
        Date now = new Date();
        Date expriyDate = new Date(now.getTime() + jwtExpirationMs);
        return Jwts.builder()
                .setSubject(userPrincipal.getEmployeeCode())
                .claim("id", userPrincipal.getId())
                .claim("employeeCode", userPrincipal.getEmployeeCode())
                .claim("fullName", userPrincipal.getFullName())
                .claim("email", userPrincipal.getEmail())
                .setIssuedAt(now)
                .setExpiration(expriyDate)
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Sinh JWT Device Token dài hạn dành riêng cho thiết bị phần cứng / Trạm Kiosk (Thời hạn 10 năm)
     */
    public String generateKioskDeviceToken(String kioskCode, String kioskName) {
        Date now = new Date();
        long tenYearsMs = 10L * 365 * 24 * 60 * 60 * 1000;
        Date expriyDate = new Date(now.getTime() + tenYearsMs);

        return Jwts.builder()
                .setSubject(kioskCode)
                .claim("kioskCode", kioskCode)
                .claim("kioskName", kioskName)
                .claim("type", "KIOSK_DEVICE")
                .setIssuedAt(now)
                .setExpiration(expriyDate)
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String getSubjectFromJwt(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();

        return claims.getSubject();
    }

    public String getEmailFromJwt(String token) {
        return getSubjectFromJwt(token);
    }

    public boolean validateToken(String authToken) {
        try {
            Jwts.parserBuilder().setSigningKey(getSigningKey()).build().parseClaimsJws(authToken);
            return true;
        } catch (JwtException | IllegalArgumentException ex) {
            return false;
        }
    }
}
