import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import type { Router } from 'vue-router';

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function installAndroidBackHandler(router: Router): void {
  if (!isAndroidNative()) return;
  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const event = new Event('plannerfin:android-back', { cancelable: true });
    if (!window.dispatchEvent(event)) return;
    const current = router.currentRoute.value.path;
    if (canGoBack && current !== '/' && current !== '/dashboard') {
      router.back();
      return;
    }
    void CapacitorApp.exitApp();
  });
}
