package org.sharingbridge.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Map;
import org.junit.jupiter.api.Test;

class DeviceTokenServiceTest {

    @Test
    void validateRequiresFcmToken() {
        assertEquals(
                "fcm_token is required.",
                DeviceTokenService.validateUpsertDeviceTokenRequest(Map.of()));
        assertNull(DeviceTokenService.validateUpsertDeviceTokenRequest(Map.of("fcm_token", "abc")));
    }

    @Test
    void buildDefaultsPlatformToAndroid() {
        Map<String, Object> record =
                DeviceTokenService.buildDeviceTokenRecord(Map.of("fcm_token", " tok "), "user-1");
        assertEquals("user-1", record.get("user_id"));
        assertEquals("tok", record.get("fcm_token"));
        assertEquals("android", record.get("platform"));
    }
}
