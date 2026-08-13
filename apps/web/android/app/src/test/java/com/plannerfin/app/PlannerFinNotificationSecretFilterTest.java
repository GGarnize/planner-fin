package com.plannerfin.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PlannerFinNotificationSecretFilterTest {
    @Test
    public void descartaOtpECodigoDeVerificacaoAntesDoBuffer() {
        assertTrue(PlannerFinNotificationSecretFilter.isProbableSecret(
                "Banco Exemplo",
                "Seu codigo de verificacao 123456 vence em 5 minutos"));
        assertTrue(PlannerFinNotificationSecretFilter.isProbableSecret(
                "Seguranca",
                "OTP para login: 654321"));
    }

    @Test
    public void permiteTextoComumSemIndicadorDeSegredo() {
        assertFalse(PlannerFinNotificationSecretFilter.isProbableSecret(
                "Compra aprovada",
                "Compra aprovada em Padaria Exemplo"));
    }
}
