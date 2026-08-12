package org.sharingbridge.integration.client;

public class UserServicePreferencesException extends RuntimeException {

    private final int status;
    private final String code;

    public UserServicePreferencesException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code == null || code.isBlank() ? "preferences_backend_error" : code;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
