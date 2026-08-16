import { registerPlugin } from '@capacitor/core';
import { isAndroidNative } from './mobile';

export interface NotificationAccessStatus {
  supported: boolean;
  granted: boolean;
}

export interface NotificationCaptureState {
  captureEnabled: boolean;
  monitoredPackages: string[];
  capturedCount: number;
  pendingCount?: number;
  encryptedBytes?: number;
  secretDropped: number;
  evictedOldest?: number;
  expiredPurged?: number;
  deviceId?: string;
  ownerBindingId?: string;
}

export interface CapturedNotificationDebugEvent {
  localId?: string;
  ownerBindingId?: string;
  deviceId?: string;
  packageName: string;
  key?: string;
  notificationKeyHash?: string;
  postTime?: number;
  postedAt?: number;
  capturedAt?: number;
  title: string;
  text: string;
  subText: string;
  bigText: string;
  fingerprintVersion?: 1;
}

export interface CapturedNotificationsDebug {
  events: CapturedNotificationDebugEvent[];
  capturedCount: number;
  secretDropped: number;
}

interface PlannerFinNotificationListenerPlugin {
  getNotificationAccessStatus(): Promise<NotificationAccessStatus>;
  openNotificationAccessSettings(): Promise<void>;
  setCaptureEnabled(options: { enabled: boolean }): Promise<NotificationCaptureState>;
  setMonitoredPackages(options: { packages: string[] }): Promise<NotificationCaptureState>;
  getCaptureState(): Promise<NotificationCaptureState>;
  getOrCreateDeviceId(): Promise<{ deviceId: string }>;
  bindOwner(options: { deviceId: string; ownerBindingId: string }): Promise<NotificationCaptureState>;
  unbindOwnerAndPurge(): Promise<NotificationCaptureState>;
  purgePendingQueue(): Promise<NotificationCaptureState>;
  getQueueStats(): Promise<{
    pendingCount: number;
    encryptedBytes: number;
    secretDropped: number;
    evictedOldest: number;
    expiredPurged: number;
  }>;
  peekPendingBatch(options: { limit: number }): Promise<{ items: CapturedNotificationDebugEvent[] }>;
  ackPending(options: { localIds: string[] }): Promise<NotificationCaptureState>;
  purgeExpired(): Promise<NotificationCaptureState & { purgedCount: number }>;
  getRecentCapturedNotifications(): Promise<CapturedNotificationsDebug>;
  clearRecentCapturedNotifications(): Promise<CapturedNotificationsDebug>;
}

const plugin = registerPlugin<PlannerFinNotificationListenerPlugin>('PlannerFinNotificationListener');

export function isNotificationListenerDiagnosticAvailable(): boolean {
  return isAndroidNative();
}

export async function getNotificationAccessStatus(): Promise<NotificationAccessStatus> {
  if (!isNotificationListenerDiagnosticAvailable()) return { supported: false, granted: false };
  return plugin.getNotificationAccessStatus();
}

export async function openNotificationAccessSettings(): Promise<void> {
  if (!isNotificationListenerDiagnosticAvailable()) return;
  await plugin.openNotificationAccessSettings();
}

const EMPTY_CAPTURE_STATE: NotificationCaptureState = {
  captureEnabled: false,
  monitoredPackages: [],
  capturedCount: 0,
  secretDropped: 0,
};

export async function setCaptureEnabled(enabled: boolean): Promise<NotificationCaptureState> {
  if (!isNotificationListenerDiagnosticAvailable()) return { ...EMPTY_CAPTURE_STATE, captureEnabled: enabled };
  return plugin.setCaptureEnabled({ enabled });
}

export async function setMonitoredPackages(packages: string[]): Promise<NotificationCaptureState> {
  if (!isNotificationListenerDiagnosticAvailable()) return { ...EMPTY_CAPTURE_STATE, monitoredPackages: packages };
  return plugin.setMonitoredPackages({ packages });
}

export async function getCaptureState(): Promise<NotificationCaptureState> {
  if (!isNotificationListenerDiagnosticAvailable()) {
    return { captureEnabled: false, monitoredPackages: [], capturedCount: 0, secretDropped: 0 };
  }
  return plugin.getCaptureState();
}

export async function getRecentCapturedNotifications(): Promise<CapturedNotificationsDebug> {
  if (!isNotificationListenerDiagnosticAvailable()) {
    return { events: [], capturedCount: 0, secretDropped: 0 };
  }
  return plugin.getRecentCapturedNotifications();
}

export async function clearRecentCapturedNotifications(): Promise<CapturedNotificationsDebug> {
  if (!isNotificationListenerDiagnosticAvailable()) {
    return { events: [], capturedCount: 0, secretDropped: 0 };
  }
  return plugin.clearRecentCapturedNotifications();
}

export async function getOrCreateDeviceId(): Promise<string | null> {
  if (!isNotificationListenerDiagnosticAvailable()) return null;
  return (await plugin.getOrCreateDeviceId()).deviceId;
}

export async function bindOwnerNative(deviceId: string, ownerBindingId: string) {
  if (!isNotificationListenerDiagnosticAvailable()) return;
  await plugin.bindOwner({ deviceId, ownerBindingId });
}

export async function unbindOwnerAndPurge(): Promise<void> {
  if (!isNotificationListenerDiagnosticAvailable()) return;
  await plugin.unbindOwnerAndPurge();
}

/**
 * Purga somente a fila nativa pendente, preservando deviceId/ownerBindingId/
 * monitoredPackages — usado por "Desativar e apagar histórico".
 */
export async function purgePendingQueue(): Promise<NotificationCaptureState> {
  if (!isNotificationListenerDiagnosticAvailable()) return { ...EMPTY_CAPTURE_STATE };
  return plugin.purgePendingQueue();
}

export async function peekPendingBatch(limit = 50): Promise<CapturedNotificationDebugEvent[]> {
  if (!isNotificationListenerDiagnosticAvailable()) return [];
  return (await plugin.peekPendingBatch({ limit })).items;
}

export async function ackPending(localIds: string[]): Promise<void> {
  if (!isNotificationListenerDiagnosticAvailable() || !localIds.length) return;
  await plugin.ackPending({ localIds });
}

export async function purgeExpired(): Promise<void> {
  if (!isNotificationListenerDiagnosticAvailable()) return;
  await plugin.purgeExpired();
}
