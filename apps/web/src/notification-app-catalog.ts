export interface NotificationAppCatalogEntry {
  packageName: string;
  label: string;
}

// Versioned, local catalog (SPEC-022 §9.2) — no QUERY_ALL_PACKAGES, no installed-app listing.
// The catalog only offers apps for the user to opt into; it never enables monitoring by itself.
// Package names below are illustrative examples named in the approved SPEC; verify each against
// the current Play Store listing before relying on them in a physical-device test or release.
export const NOTIFICATION_APP_CATALOG_VERSION = 1;

export const NOTIFICATION_APP_CATALOG: NotificationAppCatalogEntry[] = [
  { packageName: 'com.nu.production', label: 'Nubank' },
  { packageName: 'com.c6bank.app', label: 'C6 Bank' },
  { packageName: 'br.com.banrisul.mobile', label: 'Banrisul' },
];

export function catalogLabelFor(packageName: string): string | null {
  return NOTIFICATION_APP_CATALOG.find((entry) => entry.packageName === packageName)?.label ?? null;
}
