package org.sharingbridge.integration.auth;

public final class Roles {

    public static final String ROLE_INITIATOR = "initiator";
    /** JWT/DB legacy alias — treated as initiator. */
    @Deprecated
    public static final String ROLE_DONOR = "donor";
    public static final String ROLE_COORDINATOR = "coordinator";

    private Roles() {}

    public static boolean isInitiatorRole(String role) {
        return ROLE_INITIATOR.equals(role) || ROLE_DONOR.equals(role);
    }

    public static String normalizeRole(String role) {
        if (ROLE_COORDINATOR.equals(role)) {
            return ROLE_COORDINATOR;
        }
        if (isInitiatorRole(role)) {
            return ROLE_INITIATOR;
        }
        return ROLE_INITIATOR;
    }
}
