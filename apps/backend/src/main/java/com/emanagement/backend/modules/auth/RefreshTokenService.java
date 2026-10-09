package com.emanagement.backend.modules.auth;

import com.emanagement.backend.modules.employee.User;

public interface RefreshTokenService {

    String createRefreshToken(User user);

    RefreshToken verifyAndGet(String rawToken);

    String rotateRefreshToken(RefreshToken existingToken);

    void revokeToken(String rawToken);

    void revokeAllUserTokens(Long userId);
}
