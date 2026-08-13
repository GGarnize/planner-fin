package com.plannerfin.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Set;

import org.junit.Test;

public class PlannerFinNotificationCaptureStateTest {
    @Test
    public void capturaSomenteQuandoHabilitadaEPacoteMonitorado() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(false);
        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of("com.example.bank"));

        assertFalse(PlannerFinNotificationCaptureState.shouldCapture("com.example.bank"));

        PlannerFinNotificationCaptureState.setCaptureEnabled(true);

        assertTrue(PlannerFinNotificationCaptureState.shouldCapture("com.example.bank"));
        assertFalse(PlannerFinNotificationCaptureState.shouldCapture("com.example.chat"));
    }

    @Test
    public void ignoraPackageNameInvalido() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(true);
        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of("invalid", "com.example.valid"));

        assertFalse(PlannerFinNotificationCaptureState.shouldCapture("invalid"));
        assertTrue(PlannerFinNotificationCaptureState.shouldCapture("com.example.valid"));
    }
}
