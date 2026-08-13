package com.plannerfin.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

public class PlannerFinNotificationListenerService extends NotificationListenerService {
    private static final String TAG = "PlannerFinNotif";

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        PlannerFinNotificationPreferences.load(this);
        Log.i(TAG, "Notification listener conectado.");
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        Log.i(TAG, "Notification listener desconectado.");
        requestRebind(new android.content.ComponentName(this, PlannerFinNotificationListenerService.class));
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        PlannerFinNotificationPreferences.load(this);
        if (!PlannerFinNotificationCaptureState.shouldCapture(packageName)) {
            return;
        }

        Notification notification = sbn.getNotification();
        Bundle extras = notification != null ? notification.extras : Bundle.EMPTY;
        String title = readText(extras, Notification.EXTRA_TITLE);
        String text = readText(extras, Notification.EXTRA_TEXT);
        String subText = readText(extras, Notification.EXTRA_SUB_TEXT);
        String bigText = readText(extras, Notification.EXTRA_BIG_TEXT);

        if (PlannerFinNotificationSecretFilter.isProbableSecret(title, text, subText, bigText)) {
            PlannerFinNotificationBuffer.incrementSecretDropped();
            Log.i(TAG, "Conteudo sensivel descartado pelo listener.");
            return;
        }

        PlannerFinNotificationBuffer.add(new PlannerFinNotificationEvent(
                packageName,
                sbn.getKey(),
                sbn.getPostTime(),
                title,
                text,
                subText,
                bigText));
        Log.i(TAG, "Notificacao capturada no buffer efemero.");
    }

    private static String readText(Bundle extras, String key) {
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString();
    }
}
