package com.plannerfin.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

final class PlannerFinNotificationBuffer {
    private static final int MAX_EVENTS = 20;
    private static final Deque<PlannerFinNotificationEvent> EVENTS = new ArrayDeque<>();
    private static int secretDropped = 0;

    private PlannerFinNotificationBuffer() {}

    static synchronized void add(PlannerFinNotificationEvent event) {
        while (EVENTS.size() >= MAX_EVENTS) EVENTS.removeFirst();
        EVENTS.addLast(event);
    }

    static synchronized void incrementSecretDropped() {
        secretDropped += 1;
    }

    static synchronized int getSecretDropped() {
        return secretDropped;
    }

    static synchronized int getCapturedCount() {
        return EVENTS.size();
    }

    static synchronized void clear() {
        EVENTS.clear();
        secretDropped = 0;
    }

    static synchronized JSArray toJson() {
        JSArray items = new JSArray();
        List<PlannerFinNotificationEvent> snapshot = new ArrayList<>(EVENTS);
        for (PlannerFinNotificationEvent event : snapshot) {
            JSObject item = new JSObject();
            item.put("packageName", event.packageName);
            item.put("key", event.key);
            item.put("postTime", event.postTime);
            item.put("title", event.title);
            item.put("text", event.text);
            item.put("subText", event.subText);
            item.put("bigText", event.bigText);
            items.put(item);
        }
        return items;
    }

    static synchronized JSONArray toJsonArrayForDebug() throws JSONException {
        JSONArray items = new JSONArray();
        List<PlannerFinNotificationEvent> snapshot = new ArrayList<>(EVENTS);
        for (PlannerFinNotificationEvent event : snapshot) {
            JSONObject item = new JSONObject();
            item.put("packageName", event.packageName);
            item.put("key", event.key);
            item.put("postTime", event.postTime);
            item.put("title", event.title);
            item.put("text", event.text);
            item.put("subText", event.subText);
            item.put("bigText", event.bigText);
            items.put(item);
        }
        return items;
    }
}
