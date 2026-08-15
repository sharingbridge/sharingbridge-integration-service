package org.sharingbridge.integration.geo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SinceFilterTest {

    @Test
    void parseSinceQueryAcceptsHourMinuteDayUnits() {
        assertEquals(3_600_000L, SinceFilter.parseSinceQuery("1h"));
        assertEquals(7_200_000L, SinceFilter.parseSinceQuery("2h"));
        assertEquals(1_800_000L, SinceFilter.parseSinceQuery("30m"));
        assertNull(SinceFilter.parseSinceQuery(null));
        assertNull(SinceFilter.parseSinceQuery("bad"));
    }

    @Test
    void formatSinceQueryRendersHourWindows() {
        assertEquals("2h", SinceFilter.formatSinceQuery(SinceFilter.getDonorListSinceMs()));
    }

    @Test
    void resolveListSinceMsCapsDonorToDefaultWindow() {
        long windowMs = SinceFilter.getDonorListSinceMs();
        long historyMs = SinceFilter.getInitiatorHistorySinceMs();
        assertEquals(historyMs, SinceFilter.resolveListSinceMs("donor", null, null));
        assertEquals(historyMs, SinceFilter.resolveListSinceMs("donor", "7d", null));
        assertEquals(windowMs, SinceFilter.resolveListSinceMs("donor", "7d", "near"));
        assertNull(SinceFilter.resolveListSinceMs("coordinator", null, null));
        assertEquals(7_200_000L, SinceFilter.resolveListSinceMs("coordinator", "2h", null));
    }

    @Test
    void filterRecordsSinceKeepsRecentActivityOnly() {
        long now = java.time.Instant.parse("2026-06-02T12:00:00.000Z").toEpochMilli();
        List<Map<String, Object>> records =
                List.of(
                        Map.of("created_at", "2026-06-02T11:30:00.000Z"),
                        Map.of("created_at", "2026-06-01T10:00:00.000Z"));
        List<Map<String, Object>> filtered = SinceFilter.filterRecordsSince(records, 3_600_000L, now);
        assertEquals(1, filtered.size());
    }
}
