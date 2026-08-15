package org.sharingbridge.integration.repository;

import java.util.List;
import java.util.Map;
import org.sharingbridge.integration.service.OrderIntentGeoSql;

public interface OrderIntentStore {

    Map<String, Object> findByPackId(String userId, String packId);

    Map<String, Object> findById(String userId, String orderIntentId);

    Map<String, Object> findByIdAny(String orderIntentId);

    Map<String, Object> updateRecordForUser(String userId, Map<String, Object> record);

    UpsertResult upsertForUser(String userId, Map<String, Object> record);

    List<Map<String, Object>> listForDashboard(OrderIntentGeoSql.ListOpts opts);

    record UpsertResult(Map<String, Object> record, boolean created) {}
}
