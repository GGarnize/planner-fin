import { GenericNotificationParser } from './generic-notification.parser';
import type {
  NotificationParseInput,
  NotificationParseResult,
  NotificationParser,
} from './notification-parser.interface';

// V1 covers no specific bank yet (see SPEC-022 9.4) — only the deterministic fallback parser.
// Package-specific parsers (Nubank/Banrisul/C6...) are a documented future extension.
const PARSERS: NotificationParser[] = [new GenericNotificationParser()];
const FALLBACK = PARSERS.find((parser) => parser.packageName === null)!;

export interface ClassificationResult extends NotificationParseResult {
  classifierVersion: number;
}

export function classifyNotification(input: NotificationParseInput): ClassificationResult {
  const parser = PARSERS.find((candidate) => candidate.packageName === input.packageName) ?? FALLBACK;
  return { ...parser.parse(input), classifierVersion: parser.version };
}
