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
    public void getRecentCapturedNotifications(PluginCall call) {
        if (!isDebuggableBuild()) {
            call.reject("Disponivel somente em build debug.");
            return;
        }
        JSObject result = new JSObject();
        result.put("events", PlannerFinNotificationBuffer.toJson());
        result.put("capturedCount", PlannerFinNotificationBuffer.getCapturedCount());
        result.put("secretDropped", PlannerFinNotificationBuffer.getSecretDropped());
        call.resolve(result);
    }

    @PluginMethod
    public void clearRecentCapturedNotifications(PluginCall call) {
        if (!isDebuggableBuild()) {
            call.reject("Disponivel somente em build debug.");
            return;
        }
        PlannerFinNotificationBuffer.clear();
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
        result.put("capturedCount", PlannerFinNotificationBuffer.getCapturedCount());
        result.put("secretDropped", PlannerFinNotificationBuffer.getSecretDropped());
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
