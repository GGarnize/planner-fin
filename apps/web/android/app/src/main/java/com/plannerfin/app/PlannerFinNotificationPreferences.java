package com.plannerfin.app;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.LinkedHashSet;
import java.util.Set;

final class PlannerFinNotificationPreferences {
    private static final String PREFS = "plannerfin_notification_capture";
    private static final String CAPTURE_ENABLED = "captureEnabled";
    private static final String MONITORED_PACKAGES = "monitoredPackages";
    private static final String DEVICE_ID = "deviceId";
    private static final String OWNER_BINDING_ID = "ownerBindingId";
    private static final String SECRET_DROPPED = "secretDropped";
    private static final String EVICTED_OLDEST = "evictedOldest";
    private static final String EXPIRED_PURGED = "expiredPurged";
    private static Snapshot current = new Snapshot(false, Set.of(), "", "", 0, 0, 0);

    private PlannerFinNotificationPreferences() {}

    static void load(Context context) {
        SharedPreferences preferences = preferences(context);
        PlannerFinNotificationCaptureState.setCaptureEnabled(
                preferences.getBoolean(CAPTURE_ENABLED, false));
        PlannerFinNotificationCaptureState.setMonitoredPackages(
                preferences.getStringSet(MONITORED_PACKAGES, Set.of()));
        current = new Snapshot(
                PlannerFinNotificationCaptureState.isCaptureEnabled(),
                PlannerFinNotificationCaptureState.getMonitoredPackages(),
                preferences.getString(DEVICE_ID, ""),
                preferences.getString(OWNER_BINDING_ID, ""),
                preferences.getInt(SECRET_DROPPED, 0),
                preferences.getInt(EVICTED_OLDEST, 0),
                preferences.getInt(EXPIRED_PURGED, 0));
    }

    static void setCaptureEnabled(Context context, boolean enabled) {
        PlannerFinNotificationCaptureState.setCaptureEnabled(enabled);
        current = current.withCaptureEnabled(enabled);
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
        current = current.withMonitoredPackages(sanitized);
        preferences(context).edit().putStringSet(MONITORED_PACKAGES, sanitized).apply();
    }

    static void bindOwner(Context context, String deviceId, String ownerBindingId) {
        current = current.withBinding(deviceId, ownerBindingId);
        preferences(context).edit()
                .putString(DEVICE_ID, deviceId)
                .putString(OWNER_BINDING_ID, ownerBindingId)
                .apply();
    }

    static void unbindOwner(Context context) {
        PlannerFinNotificationCaptureState.setCaptureEnabled(false);
        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of());
        current = current.withCaptureEnabled(false).withMonitoredPackages(Set.of()).withBinding("", "");
        preferences(context).edit()
                .putBoolean(CAPTURE_ENABLED, false)
                .putStringSet(MONITORED_PACKAGES, Set.of())
                .remove(OWNER_BINDING_ID)
                .apply();
    }

    static String getOrCreateDeviceId(Context context) {
        load(context);
        if (!current.deviceId.isBlank()) return current.deviceId;
        String deviceId = java.util.UUID.randomUUID().toString().replace("-", "");
        preferences(context).edit().putString(DEVICE_ID, deviceId).apply();
        current = current.withBinding(deviceId, current.ownerBindingId);
        return deviceId;
    }

    static void incrementSecretDropped(Context context) {
        load(context);
        int value = current.secretDropped + 1;
        preferences(context).edit().putInt(SECRET_DROPPED, value).apply();
        current = current.withSecretDropped(value);
    }

    static void resetCounters(Context context) {
        load(context);
        preferences(context).edit()
                .putInt(SECRET_DROPPED, 0)
                .putInt(EVICTED_OLDEST, 0)
                .putInt(EXPIRED_PURGED, 0)
                .apply();
        current = current.withSecretDropped(0).withEvictedOldest(0).withExpiredPurged(0);
    }

    static void incrementEvictedOldest(Context context, int count) {
        load(context);
        int value = current.evictedOldest + count;
        preferences(context).edit().putInt(EVICTED_OLDEST, value).apply();
        current = current.withEvictedOldest(value);
    }

    static void incrementExpiredPurged(Context context, int count) {
        load(context);
        int value = current.expiredPurged + count;
        preferences(context).edit().putInt(EXPIRED_PURGED, value).apply();
        current = current.withExpiredPurged(value);
    }

    static Snapshot snapshot() {
        return current;
    }

    private static SharedPreferences preferences(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static final class Snapshot {
        final boolean captureEnabled;
        final Set<String> monitoredPackages;
        final String deviceId;
        final String ownerBindingId;
        final int secretDropped;
        final int evictedOldest;
        final int expiredPurged;

        Snapshot(
                boolean captureEnabled,
                Set<String> monitoredPackages,
                String deviceId,
                String ownerBindingId,
                int secretDropped,
                int evictedOldest,
                int expiredPurged) {
            this.captureEnabled = captureEnabled;
            this.monitoredPackages = monitoredPackages;
            this.deviceId = deviceId == null ? "" : deviceId;
            this.ownerBindingId = ownerBindingId == null ? "" : ownerBindingId;
            this.secretDropped = secretDropped;
            this.evictedOldest = evictedOldest;
            this.expiredPurged = expiredPurged;
        }

        boolean hasBinding() {
            return !deviceId.isBlank() && !ownerBindingId.isBlank();
        }

        Snapshot withCaptureEnabled(boolean value) {
            return new Snapshot(value, monitoredPackages, deviceId, ownerBindingId, secretDropped, evictedOldest, expiredPurged);
        }

        Snapshot withMonitoredPackages(Set<String> value) {
            return new Snapshot(captureEnabled, value, deviceId, ownerBindingId, secretDropped, evictedOldest, expiredPurged);
        }

        Snapshot withBinding(String nextDeviceId, String nextOwnerBindingId) {
            return new Snapshot(captureEnabled, monitoredPackages, nextDeviceId, nextOwnerBindingId, secretDropped, evictedOldest, expiredPurged);
        }

        Snapshot withSecretDropped(int value) {
            return new Snapshot(captureEnabled, monitoredPackages, deviceId, ownerBindingId, value, evictedOldest, expiredPurged);
        }

        Snapshot withEvictedOldest(int value) {
            return new Snapshot(captureEnabled, monitoredPackages, deviceId, ownerBindingId, secretDropped, value, expiredPurged);
        }

        Snapshot withExpiredPurged(int value) {
            return new Snapshot(captureEnabled, monitoredPackages, deviceId, ownerBindingId, secretDropped, evictedOldest, value);
        }
    }
}
