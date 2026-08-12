import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import type { Router } from 'vue-router';

type BackState = typeof globalThis & { __plannerfinSuppressNextAndroidBack?: number };

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function installAndroidBackHandler(router: Router): void {
  if (!isAndroidNative()) return;
  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const hadModal = !!document.querySelector('[role="dialog"], .backdrop, .sheet, .confirm');
    const event = new Event('plannerfin:android-back', { cancelable: true });
    window.dispatchEvent(event);
    const modalClosed =
      hadModal && !document.querySelector('[role="dialog"], .backdrop, .sheet, .confirm');
    if (hadModal || event.defaultPrevented || modalClosed) return;
    const backState = globalThis as BackState;
    if ((backState.__plannerfinSuppressNextAndroidBack ?? 0) > Date.now()) {
      backState.__plannerfinSuppressNextAndroidBack = 0;
      return;
    }
    const current = router.currentRoute.value.path;
    if (canGoBack && current !== '/' && current !== '/dashboard') {
      router.back();
      return;
    }
    void CapacitorApp.exitApp();
  });
}
