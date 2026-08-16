package com.plannerfin.app;

/**
 * Pure, Context-free routing decision for PlannerFinNotificationListenerService.onNotificationPosted
 * (SPEC-022 §9.2). Capture disabled means zero new discovery: nothing is recorded, monitored or
 * not. Capture enabled + package not monitored records observed metadata only (no content is ever
 * read). Capture enabled + package monitored proceeds to the normal capture pipeline and never
 * touches observed-app storage, since the package is already known.
 */
final class PlannerFinNotificationRouting {
    enum Decision {
        IGNORE,
        RECORD_OBSERVED,
        CAPTURE,
    }

    private PlannerFinNotificationRouting() {}

    static Decision decide(String packageName) {
        if (!PlannerFinNotificationCaptureState.isCaptureEnabled()) {
            return Decision.IGNORE;
        }
        if (!PlannerFinNotificationCaptureState.isMonitored(packageName)) {
            return Decision.RECORD_OBSERVED;
        }
        return Decision.CAPTURE;
    }
}
