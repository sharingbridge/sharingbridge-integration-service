package org.sharingbridge.integration.service;

/** Thrown when AI orchestration is unavailable or disabled (HTTP 503). */
public class AiServiceUnavailableException extends RuntimeException {

    private final String code;

    public AiServiceUnavailableException(String message) {
        this(message, "ai_unavailable");
    }

    public AiServiceUnavailableException(String message, String code) {
        super(message);
        this.code = code == null || code.isBlank() ? "ai_unavailable" : code;
    }

    public String getCode() {
        return code;
    }
}
