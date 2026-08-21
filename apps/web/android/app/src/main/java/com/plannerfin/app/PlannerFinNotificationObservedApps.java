package com.plannerfin.app;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pure, Context-free in-memory state for packages observed by the notification listener
 * (SPEC-022 §9.2 discovery). Holds only packageName/label/lastSeenAt for apps that emitted a
 * notification while PlannerFin had listener access — never notification content. Persistence
 * to disk is handled by PlannerFinNotificationPreferences, which hydrates this class on load()
 * and serializes it back after every mutation.
 */
final class PlannerFinNotificationObservedApps {
    // Defensive cap on distinct observed packages retained locally; oldest lastSeenAt is evicted first.
    static final int MAX_OBSERVED = 200;
    static final long RETENTION_MS = 30L * 24L * 60L * 60L * 1000L;

    private static final Map<String, Entry> observed = new LinkedHashMap<>();

    private PlannerFinNotificationObservedApps() {}

    static synchronized void recordObserved(String packageName, String label, long now) {
        if (!PlannerFinNotificationCaptureState.isValidPackageName(packageName)) return;
        Entry existing = observed.get(packageName);
        if (existing != null && existing.isIgnored()) return;
        String nextLabel = (label != null && !label.isBlank())
                ? label
                : (existing != null ? existing.label : null);
        observed.put(packageName, new Entry(packageName, nextLabel, now, 0L));
        purgeExpiredLocked(now);
        enforceLimitLocked();
    }

    static synchronized void ignore(String packageName, long now) {
        if (!PlannerFinNotificationCaptureState.isValidPackageName(packageName)) return;
        Entry existing = observed.get(packageName);
        String label = existing == null ? null : existing.label;
        long lastSeenAt = existing == null ? now : existing.lastSeenAt;
        observed.put(packageName, new Entry(packageName, label, lastSeenAt, now));
        enforceLimitLocked();
    }

    static synchronized void restore(String packageName) {
        Entry existing = observed.get(packageName);
        if (existing == null) return;
        observed.put(packageName, new Entry(existing.packageName, existing.label, existing.lastSeenAt, 0L));
    }

    static synchronized boolean isIgnored(String packageName) {
        Entry existing = observed.get(packageName);
        return existing != null && existing.isIgnored();
    }

    static synchronized void purgeExpired(long now) {
        purgeExpiredLocked(now);
    }

    static synchronized List<Entry> getObserved() {
        List<Entry> list = new ArrayList<>(observed.values());
        list.sort((a, b) -> Long.compare(b.lastSeenAt, a.lastSeenAt));
        return Collections.unmodifiableList(list);
    }

    static synchronized void replaceAll(List<Entry> entries) {
        observed.clear();
        for (Entry entry : entries) {
            if (PlannerFinNotificationCaptureState.isValidPackageName(entry.packageName)) {
                observed.put(entry.packageName, entry);
            }
        }
    }

    static synchronized void clear() {
        observed.clear();
    }

    private static void purgeExpiredLocked(long now) {
        long cutoff = now - RETENTION_MS;
        observed.values().removeIf(entry -> !entry.isIgnored() && entry.lastSeenAt < cutoff);
    }

    private static void enforceLimitLocked() {
        while (observed.size() > MAX_OBSERVED) {
            String oldestKey = null;
            long oldestSeen = Long.MAX_VALUE;
            for (Entry entry : observed.values()) {
                if (entry.lastSeenAt < oldestSeen) {
                    oldestSeen = entry.lastSeenAt;
                    oldestKey = entry.packageName;
                }
            }
            if (oldestKey == null) return;
            observed.remove(oldestKey);
        }
    }

    static final class Entry {
        final String packageName;
        final String label;
        final long lastSeenAt;
        final long ignoredAt;

        Entry(String packageName, String label, long lastSeenAt) {
            this(packageName, label, lastSeenAt, 0L);
        }

        Entry(String packageName, String label, long lastSeenAt, long ignoredAt) {
            this.packageName = packageName;
            this.label = label;
            this.lastSeenAt = lastSeenAt;
            this.ignoredAt = ignoredAt;
        }

        boolean isIgnored() {
            return ignoredAt > 0L;
        }
    }
}
