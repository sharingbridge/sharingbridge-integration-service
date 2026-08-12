package org.sharingbridge.integration.geo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LocalityKeyTest {

    @Test
    void normalizeLocalityKeyUppercasesPostalSegments() {
        assertEquals("IN:TN:600115", LocalityKey.normalizeLocalityKey("in:tn:600115"));
    }

    @Test
    void localityKeyChainReturnsMostSpecificFirstAncestors() {
        assertEquals(
                List.of("IN:TN:600115", "IN:TN", "IN"),
                LocalityKey.localityKeyChain("IN:TN:600115"));
    }

    @Test
    void offerAppliesToLocalityAcceptsStateCatalogForPostalDemand() {
        assertTrue(LocalityKey.offerAppliesToLocality("IN:TN", "IN:TN:600115"));
        assertTrue(LocalityKey.offerAppliesToLocality("IN:TN:600115", "IN:TN:600115"));
        assertFalse(LocalityKey.offerAppliesToLocality("IN:TN:600041", "IN:TN:600115"));
    }

    @Test
    void recordMatchesLocalityFilterIncludesDescendantsOfFilterKey() {
        assertTrue(LocalityKey.recordMatchesLocalityFilter("IN:TN:600115", "IN:TN"));
        assertFalse(LocalityKey.recordMatchesLocalityFilter("IN:TN", "IN:TN:600115"));
    }

    @Test
    void recordMatchesLocalityFilterRespectsFilterDepth() {
        String record = "IN:TN:600097";
        assertTrue(LocalityKey.recordMatchesLocalityFilter(record, "IN"));
        assertTrue(LocalityKey.recordMatchesLocalityFilter(record, "IN:TN"));
        assertTrue(LocalityKey.recordMatchesLocalityFilter(record, "IN:TN:600097"));
        assertFalse(LocalityKey.recordMatchesLocalityFilter(record, "IN:TN:600001"));
        assertFalse(LocalityKey.recordMatchesLocalityFilter(record, "IN:KA"));
    }

    @Test
    void resolveStandardOffersForLocalityPrefersPostalOverStateForSameOfferId() {
        List<Map<String, Object>> offers = List.of(
                Map.of(
                        "id",
                        "so-lunch-full",
                        "locality_key",
                        "IN:TN",
                        "menu_label",
                        "Full course lunch (state)"),
                Map.of(
                        "id",
                        "so-lunch-full",
                        "locality_key",
                        "IN:TN:600115",
                        "menu_label",
                        "Full course lunch (veg meals)"),
                Map.of(
                        "id",
                        "so-lunch-full-state",
                        "locality_key",
                        "IN:TN",
                        "menu_label",
                        "Full course lunch (state default)"));

        List<Map<String, Object>> resolved =
                LocalityKey.resolveStandardOffersForLocality(offers, "IN:TN:600115");
        Map<String, Object> lunch = resolved.stream()
                .filter(row -> "so-lunch-full".equals(row.get("id")))
                .findFirst()
                .orElseThrow();
        Map<String, Object> stateLunch = resolved.stream()
                .filter(row -> "so-lunch-full-state".equals(row.get("id")))
                .findFirst()
                .orElseThrow();
        assertEquals("IN:TN:600115", lunch.get("locality_key"));
        assertEquals("IN:TN", stateLunch.get("locality_key"));
    }

    @Test
    void isValidLocalityKeyAcceptsHierarchicalParts() {
        assertTrue(LocalityKey.isValidLocalityKey("IN:TN:600115"));
        assertTrue(LocalityKey.isValidLocalityKey("IN"));
        assertFalse(LocalityKey.isValidLocalityKey(""));
        assertFalse(LocalityKey.isValidLocalityKey("IN:TN:600115:EXTRA"));
    }
}
