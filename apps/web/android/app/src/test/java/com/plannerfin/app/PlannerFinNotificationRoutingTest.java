package com.plannerfin.app;

import static org.junit.Assert.assertEquals;

import java.util.Set;

import org.junit.Before;
import org.junit.Test;

public class PlannerFinNotificationRoutingTest {
    @Before
    public void resetState() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(false);
        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of());
        PlannerFinNotificationObservedApps.clear();
    }

    @Test
    public void capturaDesligadaIgnoraQualquerPacoteMonitoradoOuNao() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(false);
        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of("com.nu.production"));

        assertEquals(
                PlannerFinNotificationRouting.Decision.IGNORE,
                PlannerFinNotificationRouting.decide("com.example.novo"));
        assertEquals(
                PlannerFinNotificationRouting.Decision.IGNORE,
                PlannerFinNotificationRouting.decide("com.nu.production"));
    }

    @Test
    public void capturaLigadaPacoteNaoMonitoradoApenasRegistraObservado() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(true);

        assertEquals(
                PlannerFinNotificationRouting.Decision.RECORD_OBSERVED,
                PlannerFinNotificationRouting.decide("com.example.novo"));
    }

    @Test
    public void capturaLigadaPacoteMonitoradoCaptura() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(true);
        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of("com.nu.production"));

        assertEquals(
                PlannerFinNotificationRouting.Decision.CAPTURE,
                PlannerFinNotificationRouting.decide("com.nu.production"));
    }

    @Test
    public void capturaLigadaPacoteIgnoradoNaoRegistraObservadoNemCaptura() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(true);
        PlannerFinNotificationObservedApps.ignore("com.example.caju", 1_000L);

        assertEquals(
                PlannerFinNotificationRouting.Decision.IGNORE,
                PlannerFinNotificationRouting.decide("com.example.caju"));
    }

    @Test
    public void pacoteMonitoradoTemPrecedenciaSobreIgnoradoPorSerOptInExplicito() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(true);
        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of("com.example.caju"));
        PlannerFinNotificationObservedApps.ignore("com.example.caju", 1_000L);

        assertEquals(
                PlannerFinNotificationRouting.Decision.CAPTURE,
                PlannerFinNotificationRouting.decide("com.example.caju"));
    }
}
