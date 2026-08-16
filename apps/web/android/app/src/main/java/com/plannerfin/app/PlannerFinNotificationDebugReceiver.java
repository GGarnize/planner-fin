package com.plannerfin.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public class PlannerFinNotificationDebugReceiver extends BroadcastReceiver {
    public static final String ACTION = "com.plannerfin.app.notification.DEBUG";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION.equals(intent.getAction())) {
            setResultCode(1);
            setResultData("{\"error\":\"acao invalida\"}");
            return;
        }

        String command = intent.getStringExtra("command");
        try {
            if ("configure".equals(command)) {
                String deviceId = intent.getStringExtra("deviceId");
                String ownerBindingId = intent.getStringExtra("ownerBindingId");
                if (deviceId != null && ownerBindingId != null) {
                    PlannerFinNotificationPreferences.bindOwner(context, deviceId, ownerBindingId);
                } else {
                    PlannerFinNotificationPreferences.getOrCreateDeviceId(context);
                    PlannerFinNotificationPreferences.bindOwner(
                            context,
                            PlannerFinNotificationPreferences.snapshot().deviceId,
                            "11111111-1111-4111-8111-111111111122");
                }
                PlannerFinNotificationPreferences.setCaptureEnabled(
                        context,
                        intent.getBooleanExtra("captureEnabled", false));
                PlannerFinNotificationPreferences.setMonitoredPackages(
                        context,
                        parsePackages(intent.getStringExtra("packages")));
                setJsonResult(intent.getBooleanExtra("statsOnly", false) ? statsJson(context) : stateJson(context));
                return;
            }
            if ("stats".equals(command)) {
                setJsonResult(statsJson(context));
                return;
            }
            if ("clear".equals(command)) {
                PlannerFinNotificationBuffer.clear();
                new PlannerFinNotificationQueue(context).purgeAll();
                PlannerFinNotificationPreferences.resetCounters(context);
                setJsonResult(stateJson(context));
                return;
            }
            if ("state".equals(command)) {
                PlannerFinNotificationPreferences.load(context);
                setJsonResult(stateJson(context));
                return;
            }
            if ("seed".equals(command)) {
                PlannerFinNotificationPreferences.load(context);
                PlannerFinNotificationQueue queue = new PlannerFinNotificationQueue(context);
                int count = Math.max(1, intent.getIntExtra("count", 1));
                String marker = intent.getStringExtra("marker");
                long ageMs = intent.getLongExtra("ageMs", 0L);
                long now = System.currentTimeMillis() - Math.max(0L, ageMs);
                String bigText = intent.getStringExtra("bigText");
                int bigBytes = Math.max(0, intent.getIntExtra("bigBytes", 0));
                String fixedKey = intent.getStringExtra("fixedKey");
                long fixedPostTime = intent.getLongExtra("fixedPostTime", -1L);
                if (bigText == null && bigBytes > 0) bigText = repeated("X", bigBytes);
                for (int index = 0; index < count; index += 1) {
                    String suffix = "-" + index + "-" + now;
                    long postTime = fixedPostTime >= 0 ? fixedPostTime + index : now + index;
                    queue.enqueueAt(new PlannerFinNotificationEvent(
                            "com.plannerfin.notificationtest",
                            fixedKey == null ? "debug-key" + suffix : fixedKey + "-" + index,
                            postTime,
                            "Compra aprovada",
                            marker == null ? "Compra de teste" : marker + suffix,
                            "",
                            bigText == null ? "" : bigText + suffix),
                            now + index);
                }
                setJsonResult(stateJson(context));
                return;
            }
            if ("ack".equals(command)) {
                String ids = intent.getStringExtra("localIds");
                new PlannerFinNotificationQueue(context).ack(ids == null || ids.isBlank()
                        ? List.of()
                        : List.of(ids.split(",")));
                setJsonResult(stateJson(context));
                return;
            }
            if ("purgeExpired".equals(command)) {
                new PlannerFinNotificationQueue(context).purgeExpired(System.currentTimeMillis());
                setJsonResult(stateJson(context));
                return;
            }
            if ("seedOpaqueLimit".equals(command)) {
                PlannerFinNotificationPreferences.load(context);
                int count = Math.max(1, intent.getIntExtra("count", 1));
                int payloadBytes = Math.max(1, intent.getIntExtra("payloadBytes", 1));
                new PlannerFinNotificationQueue(context).seedOpaqueForLimitTest(count, payloadBytes);
                setJsonResult(statsJson(context));
                return;
            }
            if ("purgePendingQueue".equals(command)) {
                new PlannerFinNotificationQueue(context).purgeAll();
                PlannerFinNotificationBuffer.clear();
                setJsonResult(stateJson(context));
                return;
            }
            if ("unbind".equals(command)) {
                new PlannerFinNotificationQueue(context).purgeAll();
                PlannerFinNotificationPreferences.unbindOwner(context);
                PlannerFinNotificationBuffer.clear();
                setJsonResult(stateJson(context));
                return;
            }
            setResultCode(1);
            setResultData("{\"error\":\"comando invalido\"}");
        } catch (Exception exception) {
            setResultCode(1);
            setResultData("{\"error\":\"json invalido\"}");
        }
    }

    private static Set<String> parsePackages(String value) {
        Set<String> packages = new LinkedHashSet<>();
        if (value == null || value.isBlank()) return packages;
        for (String part : value.split("[,\\n ]+")) {
            String packageName = part.trim();
            if (PlannerFinNotificationCaptureState.isValidPackageName(packageName)) {
                packages.add(packageName);
            }
        }
        return packages;
    }

    private static JSONObject stateJson(Context context) throws Exception {
        PlannerFinNotificationQueue queue = new PlannerFinNotificationQueue(context);
        com.getcapacitor.JSObject stats = queue.stats();
        com.getcapacitor.JSArray events = queue.peek(50);
        PlannerFinNotificationPreferences.Snapshot snapshot = PlannerFinNotificationPreferences.snapshot();
        JSONObject result = new JSONObject();
        result.put("captureEnabled", PlannerFinNotificationCaptureState.isCaptureEnabled());
        result.put("monitoredPackages", new JSONArray(PlannerFinNotificationCaptureState.getMonitoredPackages()));
        result.put("capturedCount", stats.optInt("pendingCount"));
        result.put("pendingCount", stats.optInt("pendingCount"));
        result.put("encryptedBytes", stats.optLong("encryptedBytes"));
        result.put("secretDropped", stats.optInt("secretDropped"));
        result.put("evictedOldest", stats.optInt("evictedOldest"));
        result.put("expiredPurged", stats.optInt("expiredPurged"));
        result.put("deviceId", snapshot.deviceId);
        result.put("ownerBindingId", snapshot.ownerBindingId);
        result.put("events", new JSONArray(events.toString()));
        return result;
    }

    private static JSONObject statsJson(Context context) throws JSONException {
        PlannerFinNotificationPreferences.load(context);
        com.getcapacitor.JSObject stats = new PlannerFinNotificationQueue(context).stats();
        PlannerFinNotificationPreferences.Snapshot snapshot = PlannerFinNotificationPreferences.snapshot();
        JSONObject result = new JSONObject();
        result.put("captureEnabled", PlannerFinNotificationCaptureState.isCaptureEnabled());
        result.put("monitoredPackages", new JSONArray(PlannerFinNotificationCaptureState.getMonitoredPackages()));
        result.put("capturedCount", stats.optInt("pendingCount"));
        result.put("pendingCount", stats.optInt("pendingCount"));
        result.put("encryptedBytes", stats.optLong("encryptedBytes"));
        result.put("secretDropped", stats.optInt("secretDropped"));
        result.put("evictedOldest", stats.optInt("evictedOldest"));
        result.put("expiredPurged", stats.optInt("expiredPurged"));
        result.put("deviceId", snapshot.deviceId);
        result.put("ownerBindingId", snapshot.ownerBindingId);
        return result;
    }

    private void setJsonResult(JSONObject result) {
        setResultCode(0);
        setResultData(result.toString());
    }

    private static String repeated(String value, int count) {
        StringBuilder builder = new StringBuilder(count);
        for (int index = 0; index < count; index += 1) builder.append(value);
        return builder.toString();
    }
}
