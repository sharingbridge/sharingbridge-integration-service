package org.sharingbridge.integration.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class SeekerDemandLink {

    private SeekerDemandLink() {}

    public static Map<String, Object> enrichVendorBidWithSeekerDemand(
            Map<String, Object> record, List<Map<String, Object>> recentSeekerDemands) {
        if (recentSeekerDemands == null || record.get("order_code") != null) {
            return record;
        }
        String locality = String.valueOf(record.get("locality_key") == null ? "" : record.get("locality_key")).trim();
        String offerId =
                String.valueOf(record.get("standard_offer_id") == null ? "" : record.get("standard_offer_id"))
                        .trim();
        for (Map<String, Object> row : recentSeekerDemands) {
            String rowLocality =
                    String.valueOf(row.get("locality_key") == null ? "" : row.get("locality_key")).trim();
            String rowOffer =
                    String.valueOf(row.get("standard_offer_id") == null ? "" : row.get("standard_offer_id"))
                            .trim();
            if (rowLocality.equals(locality) && rowOffer.equals(offerId) && row.get("order_code") != null) {
                Map<String, Object> next = JsValues.copy(record);
                next.put("seeker_demand_id", row.get("id"));
                next.put("order_code", row.get("order_code"));
                next.put(
                        "commitment_status",
                        record.get("commitment_status") != null
                                ? record.get("commitment_status")
                                : "committed");
                return next;
            }
        }
        return record;
    }

    public static List<String> connectionNotifyRecipientIds(
            Map<String, Object> seekerDemand,
            Map<String, Object> kitchenCommitment,
            List<Map<String, Object>> pledgeRecords) {
        Set<String> ids = new LinkedHashSet<>();
        if (seekerDemand != null && seekerDemand.get("reported_by_user_id") != null) {
            ids.add(String.valueOf(seekerDemand.get("reported_by_user_id")));
        }
        if (kitchenCommitment != null && kitchenCommitment.get("submitted_by_user_id") != null) {
            ids.add(String.valueOf(kitchenCommitment.get("submitted_by_user_id")));
        }
        if (pledgeRecords != null) {
            for (Map<String, Object> pledge : pledgeRecords) {
                if (pledge.get("pledged_by_user_id") != null) {
                    ids.add(String.valueOf(pledge.get("pledged_by_user_id")));
                }
            }
        }
        return new ArrayList<>(ids);
    }
}
