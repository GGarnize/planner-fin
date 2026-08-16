package com.plannerfin.app;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
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

        // Discovery (SPEC-022 §9.2): record only packageName/label/lastSeenAt for every posting
        // app, monitored or not, before any notification content is read. Non-monitored packages
        // stop here — no Notification/Bundle is ever touched for them.
        PlannerFinNotificationPreferences.recordObserved(this, packageName, resolveAppLabel(packageName));

        if (!PlannerFinNotificationCaptureState.shouldCapture(packageName)) {
            return;
        }

        Notification notification = sbn.getNotification();
        Bundle extras = notification != null ? notification.extras : Bundle.EMPTY;
        String title = readText(extras, Notification.EXTRA_TITLE);
        String text = readText(extras, Notification.EXTRA_TEXT);
        String subText = readText(extras, Notification.EXTRA_SUB_TEXT);
        String bigText = readText(extras, Notification.EXTRA_BIG_TEXT);

        if (!hasReadableContent(title, text, subText, bigText)) {
            return;
        }

        if (PlannerFinNotificationSecretFilter.isProbableSecret(title, text, subText, bigText)) {
            PlannerFinNotificationPreferences.incrementSecretDropped(this);
            if (isDebuggableBuild()) PlannerFinNotificationBuffer.incrementSecretDropped();
            Log.i(TAG, "Conteudo sensivel descartado pelo listener.");
            return;
        }

        PlannerFinNotificationEvent event = new PlannerFinNotificationEvent(
                packageName,
                sbn.getKey(),
                sbn.getPostTime(),
                title,
                text,
                subText,
                bigText);
        try {
            new PlannerFinNotificationQueue(this).enqueue(event);
            if (isDebuggableBuild()) PlannerFinNotificationBuffer.add(event);
            Log.i(TAG, "Notificacao enfileirada para sync autenticado.");
        } catch (Exception error) {
            Log.e(TAG, "Falha tecnica ao enfileirar notificacao.");
        }
    }

    private static String readText(Bundle extras, String key) {
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString();
    }

    static boolean hasReadableContent(String... parts) {
        for (String part : parts) {
            if (part != null && !part.isBlank()) {
                return true;
            }
        }
        return false;
    }

    private boolean isDebuggableBuild() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    /**
     * Resolves a human label for packageName using only the default (non-QUERY_ALL_PACKAGES)
     * PackageManager visibility available to this app. Never guesses a label from the package
     * name itself; returns null when unresolvable so callers fall back to the raw packageName.
     */
    private String resolveAppLabel(String packageName) {
        try {
            PackageManager packageManager = getPackageManager();
            ApplicationInfo appInfo = packageManager.getApplicationInfo(packageName, 0);
            CharSequence label = packageManager.getApplicationLabel(appInfo);
            return label == null ? null : label.toString();
        } catch (Exception error) {
            return null;
        }
    }
}
