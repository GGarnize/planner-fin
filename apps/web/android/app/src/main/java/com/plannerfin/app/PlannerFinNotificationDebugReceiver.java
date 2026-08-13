package com.plannerfin.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.LinkedHashSet;
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
                PlannerFinNotificationPreferences.setCaptureEnabled(
                        context,
                        intent.getBooleanExtra("captureEnabled", false));
                PlannerFinNotificationPreferences.setMonitoredPackages(
                        context,
                        parsePackages(intent.getStringExtra("packages")));
                setJsonResult(stateJson());
                return;
            }
            if ("clear".equals(command)) {
                PlannerFinNotificationBuffer.clear();
                setJsonResult(stateJson());
                return;
            }
            if ("state".equals(command)) {
                PlannerFinNotificationPreferences.load(context);
                setJsonResult(stateJson());
                return;
            }
            setResultCode(1);
            setResultData("{\"error\":\"comando invalido\"}");
        } catch (JSONException exception) {
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

    private static JSONObject stateJson() throws JSONException {
        JSONObject result = new JSONObject();
        result.put("captureEnabled", PlannerFinNotificationCaptureState.isCaptureEnabled());
        result.put("monitoredPackages", new JSONArray(PlannerFinNotificationCaptureState.getMonitoredPackages()));
        result.put("capturedCount", PlannerFinNotificationBuffer.getCapturedCount());
        result.put("secretDropped", PlannerFinNotificationBuffer.getSecretDropped());
        result.put("events", PlannerFinNotificationBuffer.toJsonArrayForDebug());
        return result;
    }

    private void setJsonResult(JSONObject result) {
        setResultCode(0);
        setResultData(result.toString());
    }
}
