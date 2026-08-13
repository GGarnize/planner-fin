package com.plannerfin.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

final class PlannerFinNotificationQueue extends SQLiteOpenHelper {
    private static final String DB_NAME = "plannerfin_notification_queue.db";
    private static final int DB_VERSION = 1;
    private static final int MAX_ITEMS = 500;
    private static final long MAX_BYTES = 10L * 1024L * 1024L;
    private static final long TTL_MS = 7L * 24L * 60L * 60L * 1000L;
    private final Context appContext;

    PlannerFinNotificationQueue(Context context) {
        super(context.getApplicationContext(), DB_NAME, null, DB_VERSION);
        appContext = context.getApplicationContext();
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE pending_notifications (" +
                "localId TEXT PRIMARY KEY, " +
                "ownerBindingId TEXT NOT NULL, " +
                "deviceId TEXT NOT NULL, " +
                "packageName TEXT NOT NULL, " +
                "notificationKeyHash TEXT NOT NULL, " +
                "postedAt INTEGER NOT NULL, " +
                "capturedAt INTEGER NOT NULL, " +
                "payload BLOB NOT NULL, " +
                "payloadBytes INTEGER NOT NULL, " +
                "createdAt INTEGER NOT NULL)");
        db.execSQL("CREATE INDEX pending_notifications_owner_idx ON pending_notifications(ownerBindingId, deviceId, createdAt)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException("Upgrade da fila nao implementado nesta versao.");
    }

    synchronized void enqueue(PlannerFinNotificationEvent event) throws Exception {
        enqueueAt(event, System.currentTimeMillis());
    }

    synchronized void enqueueAt(PlannerFinNotificationEvent event, long now) throws Exception {
        PlannerFinNotificationPreferences.Snapshot binding = PlannerFinNotificationPreferences.snapshot();
        if (!binding.hasBinding()) return;
        purgeExpired(now);
        JSONObject payload = new JSONObject();
        payload.put("localId", UUID.randomUUID().toString());
        payload.put("ownerBindingId", binding.ownerBindingId);
        payload.put("deviceId", binding.deviceId);
        payload.put("packageName", event.packageName);
        payload.put("notificationKeyHash", sha256(event.key));
        payload.put("postedAt", event.postTime);
        payload.put("capturedAt", now);
        payload.put("title", event.title);
        payload.put("text", event.text);
        payload.put("subText", event.subText);
        payload.put("bigText", event.bigText);
        payload.put("fingerprintVersion", 1);
        byte[] plain = payload.toString().getBytes(StandardCharsets.UTF_8);
        byte[] sealed = PlannerFinNotificationCrypto.encrypt(plain);
        ContentValues values = new ContentValues();
        values.put("localId", payload.getString("localId"));
        values.put("ownerBindingId", binding.ownerBindingId);
        values.put("deviceId", binding.deviceId);
        values.put("packageName", event.packageName);
        values.put("notificationKeyHash", payload.getString("notificationKeyHash"));
        values.put("postedAt", event.postTime);
        values.put("capturedAt", now);
        values.put("payload", sealed);
        values.put("payloadBytes", sealed.length);
        values.put("createdAt", now);
        SQLiteDatabase db = getWritableDatabase();
        db.insertOrThrow("pending_notifications", null, values);
        enforceLimits(db);
    }

    synchronized JSArray peek(int limit) throws Exception {
        purgeExpired(System.currentTimeMillis());
        int capped = Math.max(1, Math.min(limit, 50));
        JSArray items = new JSArray();
        try (Cursor cursor = getReadableDatabase().query(
                "pending_notifications",
                new String[]{"payload"},
                null,
                null,
                null,
                null,
                "createdAt ASC",
                String.valueOf(capped))) {
            while (cursor.moveToNext()) {
                byte[] sealed = cursor.getBlob(0);
                String json = new String(PlannerFinNotificationCrypto.decrypt(sealed), StandardCharsets.UTF_8);
                JSONObject object = new JSONObject(json);
                items.put(toJs(object));
            }
        }
        return items;
    }

    synchronized void ack(List<String> localIds) {
        if (localIds.isEmpty()) return;
        SQLiteDatabase db = getWritableDatabase();
        for (String localId : localIds) {
            if (localId != null && localId.matches("^[0-9a-fA-F-]{36}$")) {
                db.delete("pending_notifications", "localId = ?", new String[]{localId});
            }
        }
    }

    synchronized void purgeAll() {
        getWritableDatabase().delete("pending_notifications", null, null);
    }

    synchronized void seedOpaqueForLimitTest(int count, int payloadBytes) {
        PlannerFinNotificationPreferences.Snapshot binding = PlannerFinNotificationPreferences.snapshot();
        if (!binding.hasBinding()) return;
        SQLiteDatabase db = getWritableDatabase();
        SecureRandom random = new SecureRandom();
        for (int index = 0; index < count; index += 1) {
            long now = System.currentTimeMillis() + index;
            byte[] opaque = new byte[Math.max(1, payloadBytes)];
            random.nextBytes(opaque);
            ContentValues values = new ContentValues();
            values.put("localId", UUID.randomUUID().toString());
            values.put("ownerBindingId", binding.ownerBindingId);
            values.put("deviceId", binding.deviceId);
            values.put("packageName", "com.plannerfin.notificationtest");
            values.put("notificationKeyHash", "0".repeat(64));
            values.put("postedAt", now);
            values.put("capturedAt", now);
            values.put("payload", opaque);
            values.put("payloadBytes", opaque.length);
            values.put("createdAt", now);
            db.insertOrThrow("pending_notifications", null, values);
            enforceLimits(db);
        }
    }

    synchronized int purgeExpired(long now) {
        long cutoff = now - TTL_MS;
        int purged = getWritableDatabase().delete(
                "pending_notifications",
                "createdAt < ?",
                new String[]{String.valueOf(cutoff)});
        if (purged > 0) PlannerFinNotificationPreferences.incrementExpiredPurged(appContext, purged);
        return purged;
    }

    synchronized JSObject stats() {
        purgeExpired(System.currentTimeMillis());
        JSObject result = new JSObject();
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "SELECT COUNT(*), COALESCE(SUM(payloadBytes), 0) FROM pending_notifications",
                null)) {
            cursor.moveToFirst();
            result.put("pendingCount", cursor.getInt(0));
            result.put("encryptedBytes", cursor.getLong(1));
        }
        PlannerFinNotificationPreferences.Snapshot snapshot = PlannerFinNotificationPreferences.snapshot();
        result.put("secretDropped", snapshot.secretDropped);
        result.put("evictedOldest", snapshot.evictedOldest);
        result.put("expiredPurged", snapshot.expiredPurged);
        return result;
    }

    private void enforceLimits(SQLiteDatabase db) {
        while (count(db) > MAX_ITEMS || encryptedBytes(db) > MAX_BYTES) {
            String oldest = oldestId(db);
            if (oldest == null) return;
            int deleted = db.delete("pending_notifications", "localId = ?", new String[]{oldest});
            if (deleted > 0) PlannerFinNotificationPreferences.incrementEvictedOldest(appContext, deleted);
            else return;
        }
    }

    private int count(SQLiteDatabase db) {
        try (Cursor cursor = db.rawQuery("SELECT COUNT(*) FROM pending_notifications", null)) {
            cursor.moveToFirst();
            return cursor.getInt(0);
        }
    }

    private long encryptedBytes(SQLiteDatabase db) {
        try (Cursor cursor = db.rawQuery("SELECT COALESCE(SUM(payloadBytes), 0) FROM pending_notifications", null)) {
            cursor.moveToFirst();
            return cursor.getLong(0);
        }
    }

    private String oldestId(SQLiteDatabase db) {
        try (Cursor cursor = db.rawQuery(
                "SELECT localId FROM pending_notifications ORDER BY createdAt ASC LIMIT 1",
                null)) {
            return cursor.moveToFirst() ? cursor.getString(0) : null;
        }
    }

    private static JSObject toJs(JSONObject object) {
        JSObject result = new JSObject();
        for (String key : List.of(
                "localId",
                "ownerBindingId",
                "deviceId",
                "packageName",
                "notificationKeyHash",
                "title",
                "text",
                "subText",
                "bigText")) {
            result.put(key, object.optString(key, ""));
        }
        result.put("postedAt", object.optLong("postedAt"));
        result.put("capturedAt", object.optLong("capturedAt"));
        result.put("fingerprintVersion", object.optInt("fingerprintVersion", 1));
        return result;
    }

    static List<String> localIdsFromArray(com.getcapacitor.JSArray array) {
        List<String> ids = new ArrayList<>();
        for (int index = 0; index < array.length(); index += 1) {
            String value = array.optString(index, "");
            if (!value.isBlank()) ids.add(value);
        }
        return ids;
    }

    static String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        for (byte b : hashed) out.append(String.format("%02x", b));
        return out.toString();
    }
}
