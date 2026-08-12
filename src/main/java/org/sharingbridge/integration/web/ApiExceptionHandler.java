package org.sharingbridge.integration.web;

import java.util.LinkedHashMap;
import java.util.Map;
import org.sharingbridge.integration.client.UserServicePreferencesException;
import org.sharingbridge.integration.service.AiServiceUnavailableException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiException ex) {
        return body(ex.getStatus(), ex.getCode(), ex.getMessage());
    }

    @ExceptionHandler(AiServiceUnavailableException.class)
    public ResponseEntity<Map<String, Object>> handleAiUnavailable(AiServiceUnavailableException ex) {
        return body(HttpStatus.SERVICE_UNAVAILABLE, ex.getCode(), ex.getMessage());
    }

    @ExceptionHandler(UserServicePreferencesException.class)
    public ResponseEntity<Map<String, Object>> handlePreferences(UserServicePreferencesException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatus());
        if (status == null) {
            status = HttpStatus.BAD_GATEWAY;
        }
        return body(status, ex.getCode(), ex.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidJson(HttpMessageNotReadableException ex) {
        return body(HttpStatus.BAD_REQUEST, "invalid_json", "Request body must be valid JSON.");
    }

    private static ResponseEntity<Map<String, Object>> body(
            HttpStatus status, String code, String message) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("code", code);
        payload.put("message", message);
        return ResponseEntity.status(status).body(payload);
    }
}
