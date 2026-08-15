package org.sharingbridge.integration.service;

import java.security.SecureRandom;
import java.util.regex.Pattern;

public final class OrderCode {

    private static final String CODE_ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final Pattern VALID = Pattern.compile("^SB-[0-9A-Z]{4}-[0-9A-Z]{3}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private OrderCode() {}

    public static String generateOrderCode() {
        return "SB-" + pickChars(4) + "-" + pickChars(3);
    }

    public static boolean isValidOrderCode(Object value) {
        return value instanceof String text && VALID.matcher(text).matches();
    }

    private static String pickChars(int length) {
        StringBuilder out = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            out.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return out.toString();
    }
}
