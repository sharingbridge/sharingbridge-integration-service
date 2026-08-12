package org.sharingbridge.integration.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Nominatim reverse geocode client with in-memory cache. Matches Node {@code postalGeocode.js}.
 */
public class NominatimClient {

    public static final String DEFAULT_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
    public static final String DEFAULT_USER_AGENT = "SharingBridge-Integration-Service/1.0";
    private static final int GEO_CACHE_MAX = 128;
    private static final Pattern COUNTRY_CODE = Pattern.compile("^[A-Z]{2}$");

    /** Fallback when Nominatim has state but no ISO region code. */
    private static final Map<String, String> INDIAN_STATE_CODES = Map.of(
            "tamil nadu", "TN",
            "tamilnadu", "TN");

    private final String reverseUrl;
    private final String userAgent;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Duration timeout;
    private final ConcurrentHashMap<String, CacheEntry> reverseCache = new ConcurrentHashMap<>();

    public NominatimClient() {
        this(
                DEFAULT_REVERSE_URL,
                resolveUserAgent(),
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(),
                new ObjectMapper(),
                Duration.ofSeconds(5));
    }

    public NominatimClient(
            String reverseUrl,
            String userAgent,
            HttpClient httpClient,
            ObjectMapper objectMapper,
            Duration timeout) {
        this.reverseUrl = reverseUrl == null || reverseUrl.isBlank() ? DEFAULT_REVERSE_URL : reverseUrl;
        this.userAgent =
                userAgent == null || userAgent.isBlank() ? DEFAULT_USER_AGENT : userAgent.trim();
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.timeout = timeout == null ? Duration.ofSeconds(5) : timeout;
    }

    public static String resolveUserAgent() {
        String fromEnv = System.getenv("NOMINATIM_USER_AGENT");
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv.trim();
        }
        return DEFAULT_USER_AGENT;
    }

    public ReverseResult fetchReverse(double lat, double lng) {
        if (!Double.isFinite(lat) || !Double.isFinite(lng)) {
            return null;
        }
        String key = cacheKey(lat, lng);
        CacheEntry cached = reverseCache.get(key);
        if (cached != null) {
            return cached.value;
        }

        try {
            String url = reverseUrl
                    + "?lat="
                    + URLEncoder.encode(String.valueOf(lat), StandardCharsets.UTF_8)
                    + "&lon="
                    + URLEncoder.encode(String.valueOf(lng), StandardCharsets.UTF_8)
                    + "&format=json"
                    + "&addressdetails=1";
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(timeout)
                    .header("User-Agent", userAgent)
                    .GET()
                    .build();
            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                remember(key, null);
                return null;
            }
            JsonNode data = objectMapper.readTree(response.body());
            ReverseResult result = new ReverseResult(
                    formatLocalityKeyFromNominatim(data), formatDisplayAddressFromNominatim(data));
            remember(key, result);
            return result;
        } catch (Exception ex) {
            remember(key, null);
            return null;
        }
    }

    public static String formatLocalityKeyFromNominatim(JsonNode data) {
        if (data == null || !data.isObject()) {
            return null;
        }
        JsonNode address = data.get("address");
        if (address == null || !address.isObject()) {
            return null;
        }

        String country = text(address, "country_code").trim().toUpperCase(Locale.ROOT);
        if (!COUNTRY_CODE.matcher(country).matches()) {
            return null;
        }

        String region = "";
        String iso = firstText(address, "ISO3166-2-lvl4", "ISO3166-2-lvl3", "ISO3166-2");
        if (iso.contains("-")) {
            String[] split = iso.split("-", 2);
            if (split.length > 1) {
                String part = split[1].trim().toUpperCase(Locale.ROOT);
                if (!part.isEmpty()) {
                    region = part;
                }
            }
        }
        if (region.isEmpty()) {
            String state = text(address, "state");
            if (!state.isEmpty()) {
                String normalized = state.trim().toLowerCase(Locale.ROOT);
                region = INDIAN_STATE_CODES.getOrDefault(normalized, "");
            }
        }

        String postal = text(address, "postcode").replaceAll("\\s+", "").trim();

        if (!postal.isEmpty() && !region.isEmpty()) {
            return country + ":" + region + ":" + postal;
        }
        if (!region.isEmpty()) {
            return country + ":" + region;
        }
        return country;
    }

    public static String formatDisplayAddressFromNominatim(JsonNode data) {
        if (data == null || !data.isObject()) {
            return "";
        }
        String displayName = text(data, "display_name").trim();
        if (!displayName.isEmpty()) {
            return displayName;
        }
        JsonNode address = data.get("address");
        if (address == null || !address.isObject()) {
            return "";
        }
        String[] parts = {
            text(address, "house_number"),
            firstNonBlank(text(address, "road"), text(address, "pedestrian"), text(address, "footway")),
            firstNonBlank(
                    text(address, "suburb"),
                    text(address, "neighbourhood"),
                    text(address, "quarter")),
            firstNonBlank(text(address, "city"), text(address, "town"), text(address, "village")),
            text(address, "postcode"),
            text(address, "state"),
            text(address, "country")
        };
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            String trimmed = part == null ? "" : part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(", ");
            }
            sb.append(trimmed);
        }
        return sb.toString();
    }

    /** Package-visible for tests — clears the reverse cache. */
    void clearCache() {
        reverseCache.clear();
    }

    int cacheSize() {
        return reverseCache.size();
    }

    private void remember(String cacheId, ReverseResult value) {
        if (reverseCache.size() >= GEO_CACHE_MAX) {
            reverseCache.clear();
        }
        reverseCache.put(cacheId, new CacheEntry(value));
    }

    private static String cacheKey(double lat, double lng) {
        return String.format(Locale.ROOT, "%.4f,%.4f", lat, lng);
    }

    private static String text(JsonNode node, String field) {
        if (node == null) {
            return "";
        }
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return "";
        }
        if (value.isTextual() || value.isNumber() || value.isBoolean()) {
            return value.asText("");
        }
        return "";
    }

    private static String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = node.get(field);
            if (value != null && value.isTextual()) {
                return value.asText("");
            }
        }
        return "";
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    public record ReverseResult(String localityKey, String formattedAddress) {}

    private record CacheEntry(ReverseResult value) {}
}
