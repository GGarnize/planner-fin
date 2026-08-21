package com.plannerfin.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.List;

import org.junit.Before;
import org.junit.Test;

public class PlannerFinNotificationObservedAppsTest {
    @Before
    public void resetState() {
        PlannerFinNotificationObservedApps.clear();
    }

    @Test
    public void registraPacoteNaoMonitoradoComSomenteMetadataPermitida() {
        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", "Caju", 1_000L);

        List<PlannerFinNotificationObservedApps.Entry> observed = PlannerFinNotificationObservedApps.getObserved();

        assertEquals(1, observed.size());
        assertEquals("com.example.caju", observed.get(0).packageName);
        assertEquals("Caju", observed.get(0).label);
        assertEquals(1_000L, observed.get(0).lastSeenAt);
    }

    @Test
    public void novaObservacaoAtualizaLastSeenAtSemDuplicar() {
        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", "Caju", 1_000L);
        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", "Caju", 2_000L);

        List<PlannerFinNotificationObservedApps.Entry> observed = PlannerFinNotificationObservedApps.getObserved();

        assertEquals(1, observed.size());
        assertEquals(2_000L, observed.get(0).lastSeenAt);
    }

    @Test
    public void labelResolvidoPosteriormenteAtualizaSemRegredirParaNulo() {
        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", null, 1_000L);
        assertNull(PlannerFinNotificationObservedApps.getObserved().get(0).label);

        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", "Caju", 2_000L);
        assertEquals("Caju", PlannerFinNotificationObservedApps.getObserved().get(0).label);

        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", null, 3_000L);
        List<PlannerFinNotificationObservedApps.Entry> observed = PlannerFinNotificationObservedApps.getObserved();
        assertEquals("Caju", observed.get(0).label);
        assertEquals(3_000L, observed.get(0).lastSeenAt);
    }

    @Test
    public void ignoraPackageNameInvalido() {
        PlannerFinNotificationObservedApps.recordObserved("invalid", "Invalido", 1_000L);

        assertTrue(PlannerFinNotificationObservedApps.getObserved().isEmpty());
    }

    @Test
    public void purgaObservadosComMaisDeTrintaDias() {
        long now = 1_000_000_000L;
        PlannerFinNotificationObservedApps.recordObserved("com.example.antigo", "Antigo", now);
        PlannerFinNotificationObservedApps.recordObserved(
                "com.example.recente", "Recente", now + PlannerFinNotificationObservedApps.RETENTION_MS - 1);

        long later = now + PlannerFinNotificationObservedApps.RETENTION_MS + 1;
        PlannerFinNotificationObservedApps.purgeExpired(later);

        List<PlannerFinNotificationObservedApps.Entry> observed = PlannerFinNotificationObservedApps.getObserved();
        assertEquals(1, observed.size());
        assertEquals("com.example.recente", observed.get(0).packageName);
    }

    @Test
    public void purgaNaoRemoveIgnoradosPorqueElesSoVoltamPorAcaoDoUsuario() {
        long now = 1_000_000_000L;
        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", "Caju", now);
        PlannerFinNotificationObservedApps.ignore("com.example.caju", now + 1_000L);

        PlannerFinNotificationObservedApps.purgeExpired(now + PlannerFinNotificationObservedApps.RETENTION_MS + 1);

        List<PlannerFinNotificationObservedApps.Entry> observed = PlannerFinNotificationObservedApps.getObserved();
        assertEquals(1, observed.size());
        assertEquals("com.example.caju", observed.get(0).packageName);
        assertTrue(observed.get(0).isIgnored());
    }

    @Test
    public void limiteDefensivoDescartaOMaisAntigoQuandoExcedido() {
        long now = 1_000L;
        for (int index = 0; index < PlannerFinNotificationObservedApps.MAX_OBSERVED; index += 1) {
            PlannerFinNotificationObservedApps.recordObserved("com.example.app" + index, "App " + index, now + index);
        }
        assertEquals(PlannerFinNotificationObservedApps.MAX_OBSERVED, PlannerFinNotificationObservedApps.getObserved().size());

        PlannerFinNotificationObservedApps.recordObserved(
                "com.example.novo", "Novo", now + PlannerFinNotificationObservedApps.MAX_OBSERVED);

        List<PlannerFinNotificationObservedApps.Entry> observed = PlannerFinNotificationObservedApps.getObserved();
        assertEquals(PlannerFinNotificationObservedApps.MAX_OBSERVED, observed.size());
        assertTrue(observed.stream().noneMatch(entry -> entry.packageName.equals("com.example.app0")));
        assertTrue(observed.stream().anyMatch(entry -> entry.packageName.equals("com.example.novo")));
    }

    @Test
    public void clearRemoveTodosOsObservados() {
        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", "Caju", 1_000L);

        PlannerFinNotificationObservedApps.clear();

        assertTrue(PlannerFinNotificationObservedApps.getObserved().isEmpty());
    }

    @Test
    public void ignoradoNaoAtualizaLastSeenNemLabelAoReceberNovaNotificacao() {
        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", "Caju", 1_000L);
        PlannerFinNotificationObservedApps.ignore("com.example.caju", 2_000L);

        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", "Caju Novo", 3_000L);

        List<PlannerFinNotificationObservedApps.Entry> observed = PlannerFinNotificationObservedApps.getObserved();
        assertEquals(1, observed.size());
        assertEquals("Caju", observed.get(0).label);
        assertEquals(1_000L, observed.get(0).lastSeenAt);
        assertEquals(2_000L, observed.get(0).ignoredAt);
        assertTrue(PlannerFinNotificationObservedApps.isIgnored("com.example.caju"));
    }

    @Test
    public void restaurarVoltaPermitirAtualizacaoDoObservado() {
        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", "Caju", 1_000L);
        PlannerFinNotificationObservedApps.ignore("com.example.caju", 2_000L);
        PlannerFinNotificationObservedApps.restore("com.example.caju");

        PlannerFinNotificationObservedApps.recordObserved("com.example.caju", "Caju Novo", 3_000L);

        List<PlannerFinNotificationObservedApps.Entry> observed = PlannerFinNotificationObservedApps.getObserved();
        assertEquals("Caju Novo", observed.get(0).label);
        assertEquals(3_000L, observed.get(0).lastSeenAt);
        assertEquals(0L, observed.get(0).ignoredAt);
    }
}
