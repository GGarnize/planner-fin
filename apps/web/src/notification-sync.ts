import type {
  IngestCapturedNotificationsRequest,
  IngestCapturedNotificationsResponse,
  NotificationDeviceResponse,
} from '@planner-fin/shared';
import { authenticatedFetch, authState } from './auth';
import {
  ackPending,
  bindOwnerNative,
  getCaptureState,
  getOrCreateDeviceId,
  isNotificationListenerDiagnosticAvailable,
  peekPendingBatch,
  purgeExpired,
  setCaptureEnabled,
  setMonitoredPackages,
  unbindOwnerAndPurge,
} from './notification-listener';

let syncing = false;

export async function syncCapturedNotifications(): Promise<void> {
  if (syncing || !isNotificationListenerDiagnosticAvailable() || !authState.token || !authState.user) return;
  syncing = true;
  try {
    const session = await authenticatedFetch('/users/me');
    if (!session.ok) return;
    await purgeExpired();
    const deviceId = await getOrCreateDeviceId();
    if (!deviceId) return;
    const localState = await getCaptureState();
    const device = await bindDevice(deviceId, {
      captureEnabled: localState.captureEnabled,
      monitoredPackages: localState.monitoredPackages,
      replacePreferences: false,
    });
    await bindOwnerNative(device.deviceId, device.ownerBindingId);
    await setCaptureEnabled(device.captureEnabled);
    await setMonitoredPackages(device.monitoredPackages);
    const items = await peekPendingBatch(50);
    if (!items.length) return;
    const body: IngestCapturedNotificationsRequest = {
      deviceId: device.deviceId,
      ownerBindingId: device.ownerBindingId,
      items: items
        .filter((item) => item.localId && item.notificationKeyHash)
        .map((item) => ({
          localId: item.localId!,
          packageName: item.packageName,
          notificationKeyHash: item.notificationKeyHash!,
          postedAt: new Date(item.postedAt ?? 0).toISOString(),
          capturedAt: new Date(item.capturedAt ?? Date.now()).toISOString(),
          title: item.title || null,
          text: item.text || null,
          subText: item.subText || null,
          bigText: item.bigText || null,
          fingerprintVersion: 1,
        })),
    };
    if (!body.items.length) return;
    const response = await authenticatedFetch('/notifications/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
        ...(authState.csrfToken ? { 'X-CSRF-Token': authState.csrfToken } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return;
    const result = (await response.json()) as IngestCapturedNotificationsResponse;
    await ackPending([...result.acceptedLocalIds, ...result.duplicateLocalIds]);
  } finally {
    syncing = false;
  }
}

/**
 * Pushes local capture preferences (captureEnabled/monitoredPackages) to the server
 * immediately, so consent-screen toggles don't wait for the next focus/visibility sync tick.
 */
export async function pushNotificationPreferences(preferences: {
  captureEnabled: boolean;
  monitoredPackages: string[];
}): Promise<NotificationDeviceResponse | null> {
  if (!isNotificationListenerDiagnosticAvailable() || !authState.token || !authState.user) return null;
  const deviceId = await getOrCreateDeviceId();
  if (!deviceId) return null;
  const device = await bindDevice(deviceId, { ...preferences, replacePreferences: true });
  await bindOwnerNative(device.deviceId, device.ownerBindingId);
  await setCaptureEnabled(device.captureEnabled);
  await setMonitoredPackages(device.monitoredPackages);
  return device;
}

export async function purgeNotificationBindingOnLogout(): Promise<void> {
  try {
    await unbindOwnerAndPurge();
  } catch {
    // Logout precisa limpar o estado autenticado mesmo se a bridge nativa falhar.
  }
}

export function installNotificationSyncHooks(): void {
  if (!isNotificationListenerDiagnosticAvailable()) return;
  window.addEventListener('plannerfin:auth-ready', () => void syncCapturedNotifications());
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncCapturedNotifications();
  });
  window.addEventListener('focus', () => void syncCapturedNotifications());
}

async function bindDevice(
  deviceId: string,
  preferences: { captureEnabled: boolean; monitoredPackages: string[]; replacePreferences?: boolean },
): Promise<NotificationDeviceResponse> {
  const response = await authenticatedFetch('/notification-devices/bind', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authState.csrfToken ? { 'X-CSRF-Token': authState.csrfToken } : {}),
    },
    body: JSON.stringify({ deviceId, ...preferences }),
  });
  if (!response.ok) throw new Error('Nao foi possivel vincular o dispositivo.');
  return (await response.json()) as NotificationDeviceResponse;
}
