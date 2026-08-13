package com.plannerfin.app;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.LinkedHashSet;
import java.util.Set;

final class PlannerFinNotificationPreferences {
    private static final String PREFS = "plannerfin_notification_listener_spike";
    private static final String CAPTURE_ENABLED = "captureEnabled";
    private static final String MONITORED_PACKAGES = "monitoredPackages";

    private PlannerFinNotificationPreferences() {}

    static void load(Context context) {
        SharedPreferences preferences = preferences(context);
        PlannerFinNotificationCaptureState.setCaptureEnabled(
                preferences.getBoolean(CAPTURE_ENABLED, false));
        PlannerFinNotificationCaptureState.setMonitoredPackages(
                preferences.getStringSet(MONITORED_PACKAGES, Set.of()));
    }

    static void setCaptureEnabled(Context context, boolean enabled) {
        PlannerFinNotificationCaptureState.setCaptureEnabled(enabled);
        preferences(context).edit().putBoolean(CAPTURE_ENABLED, enabled).apply();
    }

    static void setMonitoredPackages(Context context, Set<String> packages) {
        Set<String> sanitized = new LinkedHashSet<>();
        for (String packageName : packages) {
            if (PlannerFinNotificationCaptureState.isValidPackageName(packageName)) {
                sanitized.add(packageName);
            }
        }
        PlannerFinNotificationCaptureState.setMonitoredPackages(sanitized);
        preferences(context).edit().putStringSet(MONITORED_PACKAGES, sanitized).apply();
    }

    private static SharedPreferences preferences(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
