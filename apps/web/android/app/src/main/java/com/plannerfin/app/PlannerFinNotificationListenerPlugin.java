package com.plannerfin.app;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "PlannerFinNotificationListener")
public class PlannerFinNotificationListenerPlugin extends Plugin {
    @PluginMethod
    public void getNotificationAccessStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("granted", isNotificationAccessGranted());
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void setCaptureEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled"));
        PlannerFinNotificationPreferences.setCaptureEnabled(getContext(), enabled);
        call.resolve(getCaptureStateResult());
    }

    @PluginMethod
    public void setMonitoredPackages(PluginCall call) {
        JSArray input = call.getArray("packages", new JSArray());
        Set<String> packages = new LinkedHashSet<>();
        for (int index = 0; index < input.length(); index += 1) {
            String packageName = input.optString(index, "");
            if (PlannerFinNotificationCaptureState.isValidPackageName(packageName)) {
                packages.add(packageName);
            }
        }
        PlannerFinNotificationPreferences.setMonitoredPackages(getContext(), packages);
        call.resolve(getCaptureStateResult());
    }

    @PluginMethod
    public void getCaptureState(PluginCall call) {
        PlannerFinNotificationPreferences.load(getContext());
        call.resolve(getCaptureStateResult());
    }

    @PluginMethod
    public void getOrCreateDeviceId(PluginCall call) {
        JSObject result = new JSObject();
        result.put("deviceId", PlannerFinNotificationPreferences.getOrCreateDeviceId(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void bindOwner(PluginCall call) {
        String deviceId = call.getString("deviceId", "");
        String ownerBindingId = call.getString("ownerBindingId", "");
        if (deviceId.isBlank() || ownerBindingId.isBlank()) {
            call.reject("deviceId e ownerBindingId sao obrigatorios.");
            return;
        }
        PlannerFinNotificationPreferences.bindOwner(getContext(), deviceId, ownerBindingId);
        JSObject result = getCaptureStateResult();
        result.put("deviceId", deviceId);
        result.put("ownerBindingId", ownerBindingId);
        call.resolve(result);
    }

    @PluginMethod
    public void unbindOwnerAndPurge(PluginCall call) {
        PlannerFinNotificationPreferences.load(getContext());
        new PlannerFinNotificationQueue(getContext()).purgeAll();
        PlannerFinNotificationPreferences.unbindOwner(getContext());
        PlannerFinNotificationBuffer.clear();
        call.resolve(getCaptureStateResult());
    }

    /**
     * Purga somente a fila nativa pendente (producao, nao debug-only).
     * Preserva deviceId, ownerBindingId, monitoredPackages e captureEnabled —
     * usado por "Desativar e apagar historico", que já desliga a captura à parte.
     */
    @PluginMethod
    public void purgePendingQueue(PluginCall call) {
        new PlannerFinNotificationQueue(getContext()).purgeAll();
        PlannerFinNotificationBuffer.clear();
        call.resolve(new PlannerFinNotificationQueue(getContext()).stats());
    }

    @PluginMethod
    public void getQueueStats(PluginCall call) {
        PlannerFinNotificationPreferences.load(getContext());
        call.resolve(new PlannerFinNotificationQueue(getContext()).stats());
    }

    @PluginMethod
    public void peekPendingBatch(PluginCall call) {
        int limit = call.getInt("limit", 50);
        try {
            JSObject result = new JSObject();
            JSArray items = new PlannerFinNotificationQueue(getContext()).peek(limit);
            result.put("items", items);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Nao foi possivel ler a fila.");
        }
    }

    @PluginMethod
    public void ackPending(PluginCall call) {
        JSArray input = call.getArray("localIds", new JSArray());
        List<String> localIds = PlannerFinNotificationQueue.localIdsFromArray(input);
        new PlannerFinNotificationQueue(getContext()).ack(localIds);
        call.resolve(new PlannerFinNotificationQueue(getContext()).stats());
    }

    @PluginMethod
    public void purgeExpired(PluginCall call) {
        int purged = new PlannerFinNotificationQueue(getContext()).purgeExpired(System.currentTimeMillis());
        JSObject result = new PlannerFinNotificationQueue(getContext()).stats();
        result.put("purgedCount", purged);
        call.resolve(result);
    }

    @PluginMethod
    public void getRecentCapturedNotifications(PluginCall call) {
        if (!isDebuggableBuild()) {
            call.reject("Disponivel somente em build debug.");
            return;
        }
        JSObject result = new JSObject();
        try {
            JSObject stats = new PlannerFinNotificationQueue(getContext()).stats();
            result.put("events", new PlannerFinNotificationQueue(getContext()).peek(50));
            result.put("capturedCount", stats.optInt("pendingCount"));
            result.put("secretDropped", stats.optInt("secretDropped"));
        } catch (Exception error) {
            call.reject("Nao foi possivel ler a fila.");
            return;
        }
        call.resolve(result);
    }

    @PluginMethod
    public void clearRecentCapturedNotifications(PluginCall call) {
        if (!isDebuggableBuild()) {
            call.reject("Disponivel somente em build debug.");
            return;
        }
        PlannerFinNotificationBuffer.clear();
        new PlannerFinNotificationQueue(getContext()).purgeAll();
        PlannerFinNotificationPreferences.resetCounters(getContext());
        JSObject result = new JSObject();
        result.put("events", new JSArray());
        result.put("capturedCount", 0);
        result.put("secretDropped", 0);
        call.resolve(result);
    }

    private JSObject getCaptureStateResult() {
        PlannerFinNotificationPreferences.load(getContext());
        JSObject result = new JSObject();
        result.put("captureEnabled", PlannerFinNotificationCaptureState.isCaptureEnabled());
        result.put("monitoredPackages", new JSArray(PlannerFinNotificationCaptureState.getMonitoredPackages()));
        JSObject stats = new PlannerFinNotificationQueue(getContext()).stats();
        result.put("capturedCount", stats.optInt("pendingCount"));
        result.put("pendingCount", stats.optInt("pendingCount"));
        result.put("encryptedBytes", stats.optLong("encryptedBytes"));
        result.put("secretDropped", stats.optInt("secretDropped"));
        result.put("evictedOldest", stats.optInt("evictedOldest"));
        result.put("expiredPurged", stats.optInt("expiredPurged"));
        PlannerFinNotificationPreferences.Snapshot snapshot = PlannerFinNotificationPreferences.snapshot();
        result.put("deviceId", snapshot.deviceId);
        result.put("ownerBindingId", snapshot.ownerBindingId);
        return result;
    }

    private boolean isDebuggableBuild() {
        return (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private boolean isNotificationAccessGranted() {
        ComponentName componentName = new ComponentName(getContext(), PlannerFinNotificationListenerService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            NotificationManager manager =
                    (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            return manager != null && manager.isNotificationListenerAccessGranted(componentName);
        }
        String enabledListeners = Settings.Secure.getString(
                getContext().getContentResolver(),
                "enabled_notification_listeners");
        if (TextUtils.isEmpty(enabledListeners)) return false;
        String flattened = componentName.flattenToString();
        for (String listener : enabledListeners.split(":")) {
            if (flattened.equalsIgnoreCase(listener)) return true;
        }
        return false;
    }
}
