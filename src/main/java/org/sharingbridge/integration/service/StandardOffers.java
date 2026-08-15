package org.sharingbridge.integration.service;

import java.util.LinkedHashMap;
import java.util.Map;

public final class StandardOffers {

    private StandardOffers() {}

    public static Map<String, Object> formatStandardOfferForApi(Map<String, Object> record) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("standard_offer_id", record.get("id"));
        out.put("locality_key", record.get("locality_key"));
        out.put("menu_label", record.get("menu_label"));
        Object price = record.get("price_inr");
        if (price == null || "".equals(price)) {
            out.put("price_inr", null);
        } else {
            out.put("price_inr", JsValues.jsNumber(price));
        }
        out.put("created_at", record.get("created_at"));
        out.put("updated_at", record.get("updated_at"));
        return out;
    }

    public static String offerBucketKey(Object localityKey, Object standardOfferId) {
        String locality = String.valueOf(localityKey == null ? "" : localityKey).trim();
        if (locality.isEmpty()) {
            locality = "unknown";
        }
        String offerId = String.valueOf(standardOfferId == null ? "" : standardOfferId).trim();
        if (offerId.isEmpty()) {
            offerId = "legacy";
        }
        return locality + "::" + offerId;
    }
}
