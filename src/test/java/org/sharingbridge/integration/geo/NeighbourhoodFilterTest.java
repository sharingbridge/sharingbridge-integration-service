package org.sharingbridge.integration.geo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NeighbourhoodFilterTest {

    @Test
    void resolveNeighbourhoodScopePrefersGeoCoordsOverLocalityKey() {
        NeighbourhoodFilter.Scope scope =
                NeighbourhoodFilter.resolveNeighbourhoodScope(
                        "coordinator", "12.94", "80.24", "IN:TN:600115", null);
        assertInstanceOf(NeighbourhoodFilter.NearScope.class, scope);
        assertEquals("near", NeighbourhoodFilter.type(scope));
    }

    @Test
    void haversineDistanceMIsZeroForSamePoint() {
        assertEquals(0.0, NeighbourhoodFilter.haversineDistanceM(12.97, 80.22, 12.97, 80.22));
    }

    @Test
    void intentMatchesNeighbourhoodUsesRadius() {
        Map<String, Object> record =
                Map.of(
                        "location_lat",
                        12.97,
                        "location_lng",
                        80.22,
                        "locality_key",
                        "12.97,80.22");
        assertTrue(
                NeighbourhoodFilter.intentMatchesNeighbourhood(
                        record, new NeighbourhoodFilter.NearScope(12.97, 80.22, 500)));
        assertFalse(
                NeighbourhoodFilter.intentMatchesNeighbourhood(
                        record, new NeighbourhoodFilter.NearScope(13.5, 81, 1000)));
    }

    @Test
    void filterRecordsByNeighbourhoodNearScopeKeepsViewerRowsWithoutGps() {
        List<Map<String, Object>> records =
                List.of(Map.of("user_id", "alice", "pack_id", "a"), Map.of("user_id", "bob", "pack_id", "b"));
        List<Map<String, Object>> filtered =
                NeighbourhoodFilter.filterRecordsByNeighbourhood(
                        records, new NeighbourhoodFilter.NearScope(12.97, 80.22, 5000), "alice", "donor");
        assertEquals(1, filtered.size());
        assertEquals("alice", filtered.get(0).get("user_id"));
    }

    @Test
    void intentMatchesNeighbourhoodLocalityIncludesDescendants() {
        Map<String, Object> record =
                Map.of(
                        "location_lat",
                        12.94,
                        "location_lng",
                        80.24,
                        "locality_key",
                        "IN:TN:600115");
        assertTrue(
                NeighbourhoodFilter.intentMatchesNeighbourhood(
                        record, new NeighbourhoodFilter.LocalityScope("IN:TN")));
        assertFalse(
                NeighbourhoodFilter.intentMatchesNeighbourhood(
                        record, new NeighbourhoodFilter.LocalityScope("IN:KA")));
    }
}
