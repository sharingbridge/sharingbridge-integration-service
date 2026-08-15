package org.sharingbridge.integration.service;

import java.util.Map;
import java.util.Set;

public final class InitiationRoutes {

    public static final String DIRECT_ORDER = "direct_order";
    public static final String ECO_KITCHEN_SELF_PAY = "eco_kitchen_self_pay";
    public static final String ECO_KITCHEN_PLEDGE = "eco_kitchen_pledge";

    private static final Set<String> ROUTE_SET =
            Set.of(DIRECT_ORDER, ECO_KITCHEN_SELF_PAY, ECO_KITCHEN_PLEDGE);

    private InitiationRoutes() {}

    public static boolean isInitiationRoute(Object value) {
        return value instanceof String text && ROUTE_SET.contains(text);
    }

    public static String resolveSeekerDemandRoute(Map<String, Object> payload) {
        Object rawObj = payload == null ? null : payload.get("initiation_route");
        String raw = rawObj instanceof String text ? text.trim() : "";
        if (!raw.isEmpty() && isInitiationRoute(raw)) {
            return raw;
        }
        return ECO_KITCHEN_PLEDGE;
    }
}
