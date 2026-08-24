package com.emanagement.backend.security;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.emanagement.backend.modules.employee.User;
import com.emanagement.backend.modules.employee.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {
    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        User user = userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new UsernameNotFoundException("Không tìm thấy người dùng với Mã nhân viên, Email hoặc Số điện thoại: " + identifier));
        return UserPrincipal.create(user);
    }
}
