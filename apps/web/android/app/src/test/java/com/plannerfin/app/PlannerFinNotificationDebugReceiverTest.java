package com.plannerfin.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PlannerFinNotificationDebugReceiverTest {
    @Test
    public void declaraAcaoDebugEsperada() {
        assertTrue(PlannerFinNotificationDebugReceiver.ACTION.startsWith("com.plannerfin.app."));
        assertFalse("com.plannerfin.app.notification.DEBUG".isBlank());
    }
}
