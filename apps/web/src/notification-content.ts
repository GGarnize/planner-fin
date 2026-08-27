function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Mantém o conteúdo bruto intacto e decide apenas quais textos devem aparecer na interface. */
export function visibleNotificationTexts(text: string | null, bigText: string | null): string[] {
  const normalizedText = text ? normalizeWhitespace(text) : '';
  const normalizedBigText = bigText ? normalizeWhitespace(bigText) : '';

  if (!normalizedText) return normalizedBigText ? [bigText!] : [];
  if (!normalizedBigText) return [text!];
  if (normalizedText === normalizedBigText) return [text!];
  if (normalizedBigText.includes(normalizedText)) return [bigText!];
  if (normalizedText.includes(normalizedBigText)) return [text!];
  return [text!, bigText!];
}
