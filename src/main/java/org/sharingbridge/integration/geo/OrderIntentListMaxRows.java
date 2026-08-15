package org.sharingbridge.integration.geo;

public final class OrderIntentListMaxRows {

    public static final int DEFAULT_MAX_ROWS = 100;
    public static final int MIN_ROWS = 1;
    public static final int MAX_ROWS = 500;

    private OrderIntentListMaxRows() {}

    public static int getOrderIntentListMaxRows() {
        String raw = System.getenv("ORDER_INTENT_LIST_MAX_ROWS");
        if (raw == null || raw.trim().isEmpty()) {
            return DEFAULT_MAX_ROWS;
        }
        try {
            int parsed = Integer.parseInt(raw.trim(), 10);
            return Math.min(MAX_ROWS, Math.max(MIN_ROWS, parsed));
        } catch (NumberFormatException ex) {
            return DEFAULT_MAX_ROWS;
        }
    }
}
