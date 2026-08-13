package com.plannerfin.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PlannerFinNotificationListenerServiceTest {
    @Test
    public void hasReadableContentReturnsFalseForBlankSystemNotification() {
        assertFalse(PlannerFinNotificationListenerService.hasReadableContent("", " ", null, ""));
    }

    @Test
    public void hasReadableContentReturnsTrueWhenAnyAllowlistedFieldHasText() {
        assertTrue(PlannerFinNotificationListenerService.hasReadableContent("", "Compra aprovada", "", ""));
    }
}
