package org.sharingbridge.integration.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rewrites initiator/legacy alias paths so Spring MVC sees canonical {@code /v1/donor-*} routes.
 */
public class ApiPathAliasFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        String withQuery = query == null || query.isEmpty() ? uri : uri + "?" + query;
        String normalized = ApiPathAliases.normalize(withQuery);
        if (normalized == null || normalized.equals(withQuery)) {
            filterChain.doFilter(request, response);
            return;
        }

        int q = normalized.indexOf('?');
        String newPath = q >= 0 ? normalized.substring(0, q) : normalized;
        String newQuery = q >= 0 ? normalized.substring(q + 1) : null;

        HttpServletRequest wrapped = new HttpServletRequestWrapper(request) {
            @Override
            public String getRequestURI() {
                return newPath;
            }

            @Override
            public StringBuffer getRequestURL() {
                StringBuffer url = new StringBuffer();
                String scheme = getScheme();
                int port = getServerPort();
                url.append(scheme).append("://").append(getServerName());
                if (("http".equals(scheme) && port != 80)
                        || ("https".equals(scheme) && port != 443)) {
                    url.append(':').append(port);
                }
                url.append(newPath);
                return url;
            }

            @Override
            public String getServletPath() {
                return newPath;
            }

            @Override
            public String getPathInfo() {
                return null;
            }

            @Override
            public String getQueryString() {
                return newQuery != null ? newQuery : super.getQueryString();
            }
        };

        filterChain.doFilter(wrapped, response);
    }
}
