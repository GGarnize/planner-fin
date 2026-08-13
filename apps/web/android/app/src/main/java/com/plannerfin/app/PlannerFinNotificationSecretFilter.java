package com.plannerfin.app;

import java.util.Locale;
import java.util.regex.Pattern;

final class PlannerFinNotificationSecretFilter {
    private static final Pattern NUMBER_CODE = Pattern.compile("(?s).*\\b\\d{4,8}\\b.*");
    private static final Pattern SENSITIVE_TERM = Pattern.compile(
            "(otp|token|senha temporaria|senha temporária|codigo de verificacao|código de verificação|codigo de acesso|código de acesso|autenticacao|autenticação|login|dispositivo novo|novo dispositivo)");

    private PlannerFinNotificationSecretFilter() {}

    static boolean isProbableSecret(String... parts) {
        StringBuilder joined = new StringBuilder();
        for (String part : parts) {
            if (part == null || part.isBlank()) continue;
            joined.append(' ').append(part);
        }
        String value = joined.toString().toLowerCase(Locale.ROOT);
        if (value.isBlank()) return false;
        if (value.contains("otp") || value.contains("token") || value.contains("senha tempor")) {
            return true;
        }
        return SENSITIVE_TERM.matcher(value).find() && NUMBER_CODE.matcher(value).matches();
    }
}
