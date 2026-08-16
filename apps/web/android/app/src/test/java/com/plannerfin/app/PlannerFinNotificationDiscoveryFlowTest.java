package com.plannerfin.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.List;
import java.util.Set;

import org.junit.Before;
import org.junit.Test;

/**
 * Exercises the same PlannerFinNotificationRouting -> PlannerFinNotificationObservedApps sequence
 * that PlannerFinNotificationListenerService.onNotificationPosted runs, standing in for a
 * StatusBarNotification/Context-driven test (unavailable in this module's plain-JUnit setup).
 */
public class PlannerFinNotificationDiscoveryFlowTest {
    @Before
    public void resetState() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(false);
        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of());
        PlannerFinNotificationObservedApps.clear();
    }

    private void simulateNotificationPosted(String packageName, String label, long now) {
        PlannerFinNotificationRouting.Decision decision = PlannerFinNotificationRouting.decide(packageName);
        if (decision == PlannerFinNotificationRouting.Decision.RECORD_OBSERVED) {
            PlannerFinNotificationObservedApps.recordObserved(packageName, label, now);
        }
    }

    @Test
    public void capturaDesligadaNaoRegistraPacoteNovoComoObservado() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(false);

        simulateNotificationPosted("com.example.novo", "Novo", 1_000L);

        assertTrue(PlannerFinNotificationObservedApps.getObserved().isEmpty());
    }

    @Test
    public void capturaLigadaPacoteNaoMonitoradoRegistraApenasMetadataMinima() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(true);

        simulateNotificationPosted("com.example.novo", "Novo", 1_000L);

        List<PlannerFinNotificationObservedApps.Entry> observed = PlannerFinNotificationObservedApps.getObserved();
        assertEquals(1, observed.size());
        assertEquals("com.example.novo", observed.get(0).packageName);
        assertEquals("Novo", observed.get(0).label);
        assertEquals(1_000L, observed.get(0).lastSeenAt);
    }

    @Test
    public void pacoteJaMonitoradoNaoEhRegistradoComoObservado() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(true);
        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of("com.nu.production"));

        simulateNotificationPosted("com.nu.production", "Nubank", 1_000L);

        assertTrue(PlannerFinNotificationObservedApps.getObserved().isEmpty());
    }

    @Test
    public void desmonitorarPacoteFazAProximaNotificacaoVoltarAAparecerComoObservada() {
        PlannerFinNotificationCaptureState.setCaptureEnabled(true);
        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of("com.nu.production"));
        simulateNotificationPosted("com.nu.production", "Nubank", 1_000L);
        assertTrue(PlannerFinNotificationObservedApps.getObserved().isEmpty());

        PlannerFinNotificationCaptureState.setMonitoredPackages(Set.of());
        simulateNotificationPosted("com.nu.production", "Nubank", 2_000L);

        List<PlannerFinNotificationObservedApps.Entry> observed = PlannerFinNotificationObservedApps.getObserved();
        assertEquals(1, observed.size());
        assertEquals("com.nu.production", observed.get(0).packageName);
        assertEquals(2_000L, observed.get(0).lastSeenAt);
    }
}
