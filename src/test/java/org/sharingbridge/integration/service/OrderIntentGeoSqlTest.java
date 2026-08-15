package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.sharingbridge.integration.geo.NeighbourhoodFilter;

class OrderIntentGeoSqlTest {

    @Test
    void buildOrderIntentListSqlDonorOwnOnlyAppliesUserIdAndSince() {
        OrderIntentGeoSql.BuiltSql built =
                OrderIntentGeoSql.buildOrderIntentListSql(
                        "extensions",
                        new OrderIntentGeoSql.ListOpts(
                                null, 7_200_000L, null, "alice", "donor", null, null));
        assertTrue(built.text().contains("updated_at >= $1"));
        assertTrue(built.text().contains("user_id = $2"));
        assertFalse(built.text().contains("extensions.ST_DWithin"));
        assertEquals("alice", built.values().get(1));
    }

    @Test
    void buildOrderIntentListSqlDonorNearUsesStDWithinAndViewerOr() {
        OrderIntentGeoSql.BuiltSql built =
                OrderIntentGeoSql.buildOrderIntentListSql(
                        "extensions",
                        new OrderIntentGeoSql.ListOpts(
                                null,
                                7_200_000L,
                                new NeighbourhoodFilter.NearScope(12.97, 80.22, 5000),
                                "alice",
                                "donor",
                                null,
                                null));
        assertTrue(built.text().contains("extensions.ST_DWithin"));
        assertTrue(built.text().contains("user_id = $"));
        assertFalse(built.text().contains("OR location IS NULL"));
        assertTrue(built.values().contains(12.97));
        assertTrue(built.values().contains(80.22));
        assertTrue(built.values().contains(5000));
    }

    @Test
    void buildOrderIntentListSqlCoordinatorWithoutScopeHasNoUserIdLock() {
        OrderIntentGeoSql.BuiltSql built =
                OrderIntentGeoSql.buildOrderIntentListSql(
                        "extensions",
                        new OrderIntentGeoSql.ListOpts(null, null, null, "coord-1", "coordinator", 25, null));
        assertFalse(built.text().contains("user_id = $1"));
        assertTrue(built.text().contains("LIMIT $"));
        assertEquals(1, built.values().size());
        assertEquals(25, built.values().get(0));
    }

    @Test
    void buildOrderIntentListSqlCoordinatorNearUsesPureGeoRadius() {
        String text =
                OrderIntentGeoSql.buildOrderIntentListSql(
                                "extensions",
                                new OrderIntentGeoSql.ListOpts(
                                        null,
                                        null,
                                        new NeighbourhoodFilter.NearScope(13, 80, 3000),
                                        "coord-1",
                                        "coordinator",
                                        null,
                                        null))
                        .text();
        assertTrue(text.contains("extensions.ST_DWithin"));
        assertFalse(text.contains("OR location IS NULL"));
        assertFalse(text.contains("user_id ="));
    }

    @Test
    void buildOrderIntentListSqlNearScopeReturnsDistanceAndSortsAscending() {
        OrderIntentGeoSql.BuiltSql built =
                OrderIntentGeoSql.buildOrderIntentListSql(
                        "extensions",
                        new OrderIntentGeoSql.ListOpts(
                                null,
                                null,
                                new NeighbourhoodFilter.NearScope(12.97, 80.22, 5000),
                                "alice",
                                "donor",
                                50,
                                null));
        assertTrue(built.text().contains("extensions.ST_Distance"));
        assertTrue(built.text().contains("distance_m"));
        assertTrue(built.text().contains("ORDER BY distance_m ASC NULLS LAST"));
        assertTrue(built.text().contains("LIMIT $"));
        assertEquals(50, built.values().get(built.values().size() - 1));
    }

    @Test
    void buildOrderIntentListSqlIncludesDeliveredAt() {
        String text =
                OrderIntentGeoSql.buildOrderIntentListSql(
                                "extensions",
                                new OrderIntentGeoSql.ListOpts(null, null, null, "alice", "donor", null, null))
                        .text();
        assertTrue(text.contains("delivered_at"));
    }

    @Test
    void buildOrderIntentListSqlCoordinatorLocalityMatchesColumnOrPayloadKey() {
        OrderIntentGeoSql.BuiltSql built =
                OrderIntentGeoSql.buildOrderIntentListSql(
                        "extensions",
                        new OrderIntentGeoSql.ListOpts(
                                null,
                                null,
                                new NeighbourhoodFilter.LocalityScope("IN:TN:600097"),
                                "coord-1",
                                "coordinator",
                                null,
                                null));
        assertTrue(built.text().contains("COALESCE"));
        assertTrue(built.text().contains("payload->>'locality_key'"));
        assertTrue(built.values().contains("IN:TN:600097"));
        assertTrue(built.values().contains("IN:TN:600097:%"));
    }
}
