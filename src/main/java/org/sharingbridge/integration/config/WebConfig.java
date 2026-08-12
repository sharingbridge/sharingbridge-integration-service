package org.sharingbridge.integration.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.sharingbridge.integration.web.ApiPathAliasFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class WebConfig {

    @Bean
    public CorsProperties corsProperties() {
        return CorsProperties.fromEnvironment();
    }

    @Bean
    public FilterRegistrationBean<OncePerRequestFilter> integrationCorsFilter(
            CorsProperties corsProperties) {
        OncePerRequestFilter filter = new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(
                    HttpServletRequest request,
                    HttpServletResponse response,
                    FilterChain filterChain) throws ServletException, IOException {
                boolean allowed = applyCorsHeaders(request, response, corsProperties);
                if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
                    response.setStatus(allowed ? HttpServletResponse.SC_NO_CONTENT
                            : HttpServletResponse.SC_FORBIDDEN);
                    return;
                }
                filterChain.doFilter(request, response);
            }
        };
        FilterRegistrationBean<OncePerRequestFilter> bean = new FilterRegistrationBean<>(filter);
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        bean.addUrlPatterns("/*");
        bean.setName("integrationCorsFilter");
        return bean;
    }

    @Bean
    public FilterRegistrationBean<ApiPathAliasFilter> apiPathAliasFilter() {
        FilterRegistrationBean<ApiPathAliasFilter> bean =
                new FilterRegistrationBean<>(new ApiPathAliasFilter());
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        bean.addUrlPatterns("/*");
        bean.setName("apiPathAliasFilter");
        return bean;
    }

    static boolean applyCorsHeaders(
            HttpServletRequest request, HttpServletResponse response, CorsProperties cors) {
        String allowOrigin = cors.resolveAllowOrigin(request.getHeader("Origin"));
        if (allowOrigin == null) {
            return false;
        }
        response.setHeader("Access-Control-Allow-Origin", allowOrigin);
        response.setHeader("Vary", "Origin");
        response.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        return true;
    }
}
