package org.sharingbridge.integration.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.sharingbridge.integration.auth.Roles;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.http.HttpStatus;

public final class ConnectionHandoff {

    public static final String CONNECTION_SAFETY_COPY =
            "Confirm this order code in SharingBridge before paying anyone. We never send payment links or QR codes by email.";

    private ConnectionHandoff() {}

    public static List<Map<String, Object>> pledgesForDemand(
            List<Map<String, Object>> pledgeRecords, Map<String, Object> seekerDemand) {
        String locality =
                String.valueOf(seekerDemand.get("locality_key") == null ? "" : seekerDemand.get("locality_key"))
                        .trim();
        String offerId =
                String.valueOf(
                                seekerDemand.get("standard_offer_id") == null
                                        ? ""
                                        : seekerDemand.get("standard_offer_id"))
                        .trim();
        List<Map<String, Object>> out = new ArrayList<>();
        if (pledgeRecords == null) {
            return out;
        }
        for (Map<String, Object> row : pledgeRecords) {
            String rowLocality =
                    String.valueOf(row.get("locality_key") == null ? "" : row.get("locality_key")).trim();
            String rowOffer =
                    String.valueOf(row.get("standard_offer_id") == null ? "" : row.get("standard_offer_id"))
                            .trim();
            if (rowLocality.equals(locality) && rowOffer.equals(offerId)) {
                out.add(row);
            }
        }
        return out;
    }

    public static String resolveConnectionViewerRole(
            String authUserId,
            String authRole,
            Map<String, Object> seekerDemand,
            Map<String, Object> kitchenCommitment,
            List<Map<String, Object>> pledges) {
        if (Roles.isCoordinatorApiRole(authRole)) {
            return "coordinator";
        }
        if (kitchenCommitment != null
                && authUserId != null
                && authUserId.equals(kitchenCommitment.get("submitted_by_user_id"))) {
            return "kitchen";
        }
        if (seekerDemand != null
                && authUserId != null
                && authUserId.equals(seekerDemand.get("reported_by_user_id"))) {
            return "initiator";
        }
        if (pledges != null) {
            for (Map<String, Object> row : pledges) {
                if (authUserId != null && authUserId.equals(row.get("pledged_by_user_id"))) {
                    return "pledger";
                }
            }
        }
        return null;
    }

    public static Map<String, Object> buildConnectionHandoff(
            String orderCode,
            Map<String, Object> seekerDemand,
            Map<String, Object> kitchenCommitment,
            List<Map<String, Object>> pledgeRecords,
            Map<String, String> emailByUserId,
            String viewerRole) {
        Map<String, Object> demandApi =
                seekerDemand == null ? null : SeekerDemands.formatSeekerDemandForApi(seekerDemand);
        Map<String, Object> kitchenApi =
                kitchenCommitment == null ? null : Marketplace.formatVendorBidForApi(kitchenCommitment);
        List<Map<String, Object>> pledgesApi = new ArrayList<>();
        if (pledgeRecords != null) {
            for (Map<String, Object> row : pledgeRecords) {
                pledgesApi.add(Marketplace.formatPledgeForApi(row));
            }
        }
        String status = kitchenCommitment != null ? "ready" : "pending_kitchen";
        Map<String, String> emails = emailByUserId == null ? Map.of() : emailByUserId;

        String initiatorKey =
                seekerDemand == null || seekerDemand.get("reported_by_user_id") == null
                        ? ""
                        : String.valueOf(seekerDemand.get("reported_by_user_id"));
        String kitchenKey =
                kitchenCommitment == null || kitchenCommitment.get("submitted_by_user_id") == null
                        ? ""
                        : String.valueOf(kitchenCommitment.get("submitted_by_user_id"));
        String initiatorEmail = emails.get(initiatorKey);
        String kitchenEmail = emails.get(kitchenKey);

        List<Map<String, Object>> pledgers = new ArrayList<>();
        for (Map<String, Object> row : pledgesApi) {
            Object pledgedBy = row.get("pledged_by_user_id");
            String login = pledgedBy == null ? null : emails.get(String.valueOf(pledgedBy));
            if (login == null) {
                continue;
            }
            Map<String, Object> pledger = new LinkedHashMap<>();
            pledger.put("pledged_by_user_id", pledgedBy);
            pledger.put("meal_units", row.get("meal_units"));
            pledger.put("login_email", login);
            pledgers.add(pledger);
        }

        Map<String, Object> demand = null;
        if (demandApi != null) {
            demand = new LinkedHashMap<>();
            demand.put("seeker_demand_id", demandApi.get("seeker_demand_id"));
            demand.put("status", demandApi.get("status"));
            demand.put("need_description", demandApi.get("need_description"));
            demand.put(
                    "verbal_notes",
                    demandApi.get("verbal_notes") != null ? demandApi.get("verbal_notes") : "");
            demand.put(
                    "location_label",
                    demandApi.get("location_label") != null ? demandApi.get("location_label") : "");
            demand.put(
                    "standard_offer_id",
                    demandApi.get("standard_offer_id") != null ? demandApi.get("standard_offer_id") : null);
            demand.put("recorded_at", demandApi.get("created_at"));
        }

        Object menuLabel = "";
        if (demandApi != null && demandApi.get("menu_label") != null) {
            menuLabel = demandApi.get("menu_label");
        } else if (kitchenApi != null && kitchenApi.get("menu_label") != null) {
            menuLabel = kitchenApi.get("menu_label");
        }
        Object localityKey = "";
        if (demandApi != null && demandApi.get("locality_key") != null) {
            localityKey = demandApi.get("locality_key");
        } else if (kitchenApi != null && kitchenApi.get("locality_key") != null) {
            localityKey = kitchenApi.get("locality_key");
        }

        Map<String, Object> base = new LinkedHashMap<>();
        base.put("order_code", orderCode);
        base.put("status", status);
        base.put(
                "initiation_route",
                demandApi != null && demandApi.get("initiation_route") != null
                        ? demandApi.get("initiation_route")
                        : InitiationRoutes.ECO_KITCHEN_PLEDGE);
        base.put("viewer_role", viewerRole);
        base.put("safety_copy", CONNECTION_SAFETY_COPY);
        base.put("menu_label", menuLabel);
        base.put("meal_units", demandApi == null ? null : demandApi.get("meal_units"));
        base.put("price_inr", demandApi == null ? null : demandApi.get("price_inr"));
        base.put("locality_key", localityKey);
        base.put("seeker_demand_id", demandApi == null ? null : demandApi.get("seeker_demand_id"));
        base.put("demand", demand);

        if (!"ready".equals(status)) {
            Map<String, Object> out = new LinkedHashMap<>(base);
            if (kitchenApi != null) {
                Map<String, Object> kitchen = new LinkedHashMap<>();
                kitchen.put("display_name", kitchenApi.get("vendor_name"));
                kitchen.put("commitment_status", "pending");
                out.put("kitchen", kitchen);
            } else {
                out.put("kitchen", null);
            }
            return out;
        }

        if ("kitchen".equals(viewerRole) || "coordinator".equals(viewerRole)) {
            Map<String, Object> out = new LinkedHashMap<>(base);
            Map<String, Object> kitchen = new LinkedHashMap<>();
            kitchen.put("display_name", kitchenApi == null ? "" : kitchenApi.get("vendor_name"));
            kitchen.put("login_email", kitchenEmail);
            out.put("kitchen", kitchen);
            if (initiatorEmail != null) {
                Map<String, Object> initiator = new LinkedHashMap<>();
                initiator.put("login_email", initiatorEmail);
                out.put("initiator", initiator);
            } else {
                out.put("initiator", null);
            }
            out.put("pledgers", pledgers);
            return out;
        }

        if ("initiator".equals(viewerRole) || "pledger".equals(viewerRole)) {
            Map<String, Object> out = new LinkedHashMap<>(base);
            Map<String, Object> kitchen = new LinkedHashMap<>();
            kitchen.put("display_name", kitchenApi == null ? "" : kitchenApi.get("vendor_name"));
            kitchen.put("login_email", kitchenEmail);
            out.put("kitchen", kitchen);
            out.put("counterparty_email", kitchenEmail);
            return out;
        }

        return base;
    }

    public static Map<String, Object> wrapConnection(Map<String, Object> connection) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("connection", connection);
        return body;
    }

    public static ApiException invalidOrderCode() {
        return new ApiException(
                HttpStatus.BAD_REQUEST, "invalid_order_code", "order_code must match SB-XXXX-XXX.");
    }

    public static ApiException schemaPending() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "connection_schema_pending",
                "Order lookup is not available until Eco Kitchen Phase 3 migration is applied.");
    }

    public static ApiException orderNotFound(String orderCode) {
        return new ApiException(
                HttpStatus.NOT_FOUND, "order_not_found", "No initiation found for order " + orderCode + ".");
    }

    public static ApiException forbidden() {
        return new ApiException(
                HttpStatus.FORBIDDEN,
                "connection_forbidden",
                "You are not a party on this order. Only the initiator, pledgers, kitchen, or a coordinator can view the connection.");
    }
}
