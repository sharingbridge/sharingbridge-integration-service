package org.sharingbridge.integration.client;

public class AiOrchestrationException extends RuntimeException {

    private final Integer status;
    private final String code;
    private final String phase;
    private String path;
    private final String host;
    private final String contentType;
    private final String responseKind;
    private final String bodyPreview;
    private final String upstreamDetail;
    private final String hint;
    private Integer attempts;
    private Integer maxAttempts;

    public AiOrchestrationException(String message, Builder builder) {
        super(message);
        this.status = builder.status;
        this.code = builder.code;
        this.phase = builder.phase;
        this.path = builder.path;
        this.host = builder.host;
        this.contentType = builder.contentType;
        this.responseKind = builder.responseKind;
        this.bodyPreview = builder.bodyPreview;
        this.upstreamDetail = builder.upstreamDetail;
        this.hint = builder.hint;
        this.attempts = builder.attempts;
        this.maxAttempts = builder.maxAttempts;
    }

    public Integer getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public String getPhase() {
        return phase;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getHost() {
        return host;
    }

    public String getContentType() {
        return contentType;
    }

    public String getResponseKind() {
        return responseKind;
    }

    public String getBodyPreview() {
        return bodyPreview;
    }

    public String getUpstreamDetail() {
        return upstreamDetail;
    }

    public String getHint() {
        return hint;
    }

    public Integer getAttempts() {
        return attempts;
    }

    public void setAttempts(Integer attempts) {
        this.attempts = attempts;
    }

    public Integer getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(Integer maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private Integer status;
        private String code;
        private String phase;
        private String path;
        private String host;
        private String contentType;
        private String responseKind;
        private String bodyPreview;
        private String upstreamDetail;
        private String hint;
        private Integer attempts;
        private Integer maxAttempts;

        public Builder status(Integer status) {
            this.status = status;
            return this;
        }

        public Builder code(String code) {
            this.code = code;
            return this;
        }

        public Builder phase(String phase) {
            this.phase = phase;
            return this;
        }

        public Builder path(String path) {
            this.path = path;
            return this;
        }

        public Builder host(String host) {
            this.host = host;
            return this;
        }

        public Builder contentType(String contentType) {
            this.contentType = contentType;
            return this;
        }

        public Builder responseKind(String responseKind) {
            this.responseKind = responseKind;
            return this;
        }

        public Builder bodyPreview(String bodyPreview) {
            this.bodyPreview = bodyPreview;
            return this;
        }

        public Builder upstreamDetail(String upstreamDetail) {
            this.upstreamDetail = upstreamDetail;
            return this;
        }

        public Builder hint(String hint) {
            this.hint = hint;
            return this;
        }

        public AiOrchestrationException build(String message) {
            return new AiOrchestrationException(message, this);
        }
    }
}
