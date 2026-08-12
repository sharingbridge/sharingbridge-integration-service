package org.sharingbridge.integration.web;

/**
 * Canonical legacy paths remain {@code /v1/donor-*} internally; clients may call initiator aliases.
 * Matches Node {@code apiPathAliases.js}.
 */
public final class ApiPathAliases {

    private ApiPathAliases() {}

    public static String normalize(String url) {
        if (url == null || url.isEmpty()) {
            return url;
        }
        int qIndex = url.indexOf('?');
        String path = qIndex >= 0 ? url.substring(0, qIndex) : url;
        String query = qIndex >= 0 ? url.substring(qIndex) : "";

        if (path.startsWith("/v1/initiator-setup")) {
            return "/v1/donor-setup" + path.substring("/v1/initiator-setup".length()) + query;
        }
        if ("/v1/instruction-pack".equals(path)) {
            return "/v1/donor-seeker/instruction-pack" + query;
        }
        if ("/v1/order-intents".equals(path)) {
            return "/v1/donor-seeker/order-intents" + query;
        }
        if (path.startsWith("/v1/order-intents/")) {
            return "/v1/donor-seeker/order-intents" + path.substring("/v1/order-intents".length())
                    + query;
        }
        return url;
    }
}
