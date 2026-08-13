package com.plannerfin.notificationemitter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class NotificationEmitterReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "plannerfin-notification-test";
    private static final String TAG = "PlannerFinNotifTest";

    @Override
    public void onReceive(Context context, Intent intent) {
        String scenario = intent.getStringExtra("scenario");
        try {
            NotificationPayload payload = payloadFor(scenario);
            NotificationManager manager =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) {
                setResultCode(1);
                setResultData("{\"posted\":false,\"reason\":\"notification_manager_unavailable\"}");
                return;
            }
            ensureChannel(manager);
            manager.notify(payload.id, payload.toNotification(context));
            Log.i(TAG, "Notificacao de teste emitida.");
            setResultCode(0);
            setResultData("{\"posted\":true,\"scenario\":\"" + payload.scenario + "\"}");
        } catch (RuntimeException error) {
            Log.e(TAG, "Falha tecnica ao emitir notificacao de teste.", error);
            setResultCode(1);
            setResultData("{\"posted\":false,\"reason\":\"runtime_error\"}");
        }
    }

    private static void ensureChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "PlannerFin notification tests",
                NotificationManager.IMPORTANCE_DEFAULT);
        manager.createNotificationChannel(channel);
    }

    private static NotificationPayload payloadFor(String scenario) {
        if ("pix".equals(scenario)) {
            return new NotificationPayload(
                    "pix",
                    1002,
                    "PIX recebido",
                    "Voce recebeu R$ 150,00 de Joao Silva",
                    "");
        }
        if ("irrelevant".equals(scenario)) {
            return new NotificationPayload(
                    "irrelevant",
                    1003,
                    "Novidades",
                    "Confira as novidades do seu banco",
                    "");
        }
        if ("otp".equals(scenario)) {
            return new NotificationPayload(
                    "otp",
                    1004,
                    "Codigo de verificacao",
                    "Seu codigo de verificacao e 123456",
                    "");
        }
        if ("long".equals(scenario)) {
            return new NotificationPayload(
                    "long",
                    1005,
                    "Resumo do cartao",
                    "Compra aprovada com detalhes",
                    "Compra aprovada no cartao final 1234 em PADARIA EXEMPLO no valor de R$ 42,90. " +
                            "Este texto longo valida o campo EXTRA_BIG_TEXT enviado pelo NotificationManager " +
                            "sem depender de extras completos, imagem, intent ou payload binario.");
        }
        if ("other".equals(scenario)) {
            return new NotificationPayload(
                    "other",
                    1006,
                    "Compra aprovada",
                    "Compra de R$ 999,99 em OUTRO APP",
                    "");
        }
        return new NotificationPayload(
                "purchase",
                1001,
                "Compra aprovada",
                "Compra de R$ 42,90 em PADARIA EXEMPLO",
                "Compra aprovada no cartao final 1234 em PADARIA EXEMPLO no valor de R$ 42,90");
    }

    private static final class NotificationPayload {
        final String scenario;
        final int id;
        final String title;
        final String text;
        final String bigText;

        NotificationPayload(String scenario, int id, String title, String text, String bigText) {
            this.scenario = scenario;
            this.id = id;
            this.title = title;
            this.text = text;
            this.bigText = bigText;
        }

        Notification toNotification(Context context) {
            Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? new Notification.Builder(context, CHANNEL_ID)
                    : new Notification.Builder(context);
            builder
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(text)
                    .setAutoCancel(true)
                    .setShowWhen(true)
                    .setWhen(System.currentTimeMillis())
                    .setCategory(Notification.CATEGORY_STATUS)
                    .setPriority(Notification.PRIORITY_DEFAULT);
            if (!bigText.isBlank()) {
                builder.setStyle(new Notification.BigTextStyle().bigText(bigText));
            }
            return builder.build();
        }
    }
}
