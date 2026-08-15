package org.sharingbridge.integration.repository;

import java.util.List;
import java.util.Map;

public interface SeekerDemandStore {

    boolean isEnabled();

    Map<String, Object> insertForReporter(String reportedByUserId, Map<String, Object> record);

    List<Map<String, Object>> listRecent(int limit, String reporterUserIdFilter);

    Map<String, Object> findById(String seekerDemandId);

    Map<String, Object> findByOrderCode(String orderCode);

    Map<String, Object> updateByCoordinator(String seekerDemandId, Map<String, Object> record);
}
