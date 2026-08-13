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
  secretDropped: number;
}

export interface CapturedNotificationDebugEvent {
  packageName: string;
  key: string;
  postTime: number;
  title: string;
  text: string;
  subText: string;
  bigText: string;
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

export async function setCaptureEnabled(enabled: boolean): Promise<NotificationCaptureState> {
  return plugin.setCaptureEnabled({ enabled });
}

export async function setMonitoredPackages(packages: string[]): Promise<NotificationCaptureState> {
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
