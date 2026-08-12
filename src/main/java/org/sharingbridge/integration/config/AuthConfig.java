package org.sharingbridge.integration.config;

import org.sharingbridge.integration.auth.JwtService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AuthConfig {

    @Bean
    public AuthProperties authProperties() {
        return AuthProperties.fromEnvironment();
    }

    @Bean
    public JwtService jwtService(AuthProperties authProperties) {
        return new JwtService(authProperties);
    }
}
