package org.sharingbridge.integration.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.sharingbridge.integration.repository.DonorEmailLookup;
import org.sharingbridge.integration.repository.MarketplaceStore;
import org.sharingbridge.integration.repository.SeekerDemandStore;
import org.sharingbridge.integration.web.ApiException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ConnectionService {

    private final SeekerDemandStore seekerDemandStore;
    private final MarketplaceStore marketplaceStore;
    private final DonorEmailLookup emailLookup;

    public ConnectionService(
            @Autowired(required = false) SeekerDemandStore seekerDemandStore,
            @Autowired(required = false) MarketplaceStore marketplaceStore,
            @Autowired(required = false) DonorEmailLookup emailLookup) {
        this.seekerDemandStore = seekerDemandStore;
        this.marketplaceStore = marketplaceStore;
        this.emailLookup = emailLookup;
    }

    public Map<String, Object> resolve(String orderCode, String authUserId, String authRole) {
        String trimmed = orderCode == null ? "" : orderCode.trim();
        if (!OrderCode.isValidOrderCode(trimmed)) {
            throw ConnectionHandoff.invalidOrderCode();
        }
        if (seekerDemandStore == null) {
            throw ConnectionHandoff.schemaPending();
        }
        Map<String, Object> seekerDemand = seekerDemandStore.findByOrderCode(trimmed);
        if (seekerDemand == null) {
            throw ConnectionHandoff.orderNotFound(trimmed);
        }
        Map<String, Object> kitchenCommitment =
                marketplaceStore == null
                        ? null
                        : marketplaceStore.findKitchenCommitmentByOrderCode(trimmed);
        List<Map<String, Object>> pledgeRecords =
                marketplaceStore == null
                        ? List.of()
                        : ConnectionHandoff.pledgesForDemand(
                                marketplaceStore.listPledges(200), seekerDemand);
        String viewerRole =
                ConnectionHandoff.resolveConnectionViewerRole(
                        authUserId, authRole, seekerDemand, kitchenCommitment, pledgeRecords);
        if (viewerRole == null) {
            throw ConnectionHandoff.forbidden();
        }
        Set<String> userIds = new LinkedHashSet<>();
        if (seekerDemand.get("reported_by_user_id") != null) {
            userIds.add(String.valueOf(seekerDemand.get("reported_by_user_id")));
        }
        if (kitchenCommitment != null && kitchenCommitment.get("submitted_by_user_id") != null) {
            userIds.add(String.valueOf(kitchenCommitment.get("submitted_by_user_id")));
        }
        for (Map<String, Object> pledge : pledgeRecords) {
            if (pledge.get("pledged_by_user_id") != null) {
                userIds.add(String.valueOf(pledge.get("pledged_by_user_id")));
            }
        }
        Map<String, String> emailByUserId =
                emailLookup == null ? Map.of() : emailLookup.lookupByUserId(List.copyOf(userIds));
        Map<String, Object> connection =
                ConnectionHandoff.buildConnectionHandoff(
                        trimmed, seekerDemand, kitchenCommitment, pledgeRecords, emailByUserId, viewerRole);
        return ConnectionHandoff.wrapConnection(connection);
    }
}
