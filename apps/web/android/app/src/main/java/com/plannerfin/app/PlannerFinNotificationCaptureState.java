package com.plannerfin.app;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

final class PlannerFinNotificationCaptureState {
    private static boolean captureEnabled = false;
    private static Set<String> monitoredPackages = new LinkedHashSet<>();

    private PlannerFinNotificationCaptureState() {}

    static synchronized void setCaptureEnabled(boolean enabled) {
        captureEnabled = enabled;
    }

    static synchronized boolean isCaptureEnabled() {
        return captureEnabled;
    }

    static synchronized void setMonitoredPackages(Set<String> packages) {
        monitoredPackages = new LinkedHashSet<>();
        for (String packageName : packages) {
            if (isValidPackageName(packageName)) monitoredPackages.add(packageName);
        }
    }

    static synchronized Set<String> getMonitoredPackages() {
        return Collections.unmodifiableSet(new LinkedHashSet<>(monitoredPackages));
    }

    static synchronized boolean shouldCapture(String packageName) {
        return captureEnabled && monitoredPackages.contains(packageName);
    }

    static boolean isValidPackageName(String packageName) {
        return packageName != null && packageName.matches("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+");
    }
}
