package org.sharingbridge.integration.repository;

import java.util.List;
import java.util.Map;

public interface MarketplaceStore {

    boolean isEnabled();

    Map<String, Object> insertPledge(Map<String, Object> record);

    Map<String, Object> insertVendorBid(Map<String, Object> record);

    List<Map<String, Object>> listPledges(int limit);

    List<Map<String, Object>> listVendorBids(int limit);

    List<Map<String, Object>> listStandardOffers(String localityKey);

    Map<String, Object> getStandardOfferById(String standardOfferId);

    Map<String, Object> findKitchenCommitmentByOrderCode(String orderCode);
}
