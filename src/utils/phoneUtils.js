/**
 * Normalizes any Israeli phone format to E.164 (+972XXXXXXXXX).
 * Returns the E.164 string on success, or null if invalid.
 */
export function normalizeIsraeliPhone(raw) {
  if (!raw) return null;

  // Strip spaces, dashes, parens, dots
  let cleaned = String(raw).replace(/[\s\-\(\)\.]/g, '');

  // Convert 00972 → +972
  if (cleaned.startsWith('00972')) cleaned = '+972' + cleaned.slice(5);
  // Convert 972 (no plus) → +972
  else if (/^972\d/.test(cleaned)) cleaned = '+' + cleaned;
  // Convert local 0X… → +972X…
  else if (cleaned.startsWith('0')) cleaned = '+972' + cleaned.slice(1);

  // Must now start with +972 followed by exactly 9 digits
  if (!/^\+972\d{9}$/.test(cleaned)) return null;

  return cleaned;
}

/**
 * Validates E.164 Israeli mobile only (05X prefix after +972).
 * Returns { valid: true, normalized } or { valid: false, reason }.
 */
export function validateIsraeliMobile(raw) {
  const normalized = normalizeIsraeliPhone(raw);
  if (!normalized) {
    return { valid: false, reason: 'פורמט לא מזוהה – ודא שזה מספר ישראלי תקין' };
  }
  // After +972, first digit must be 5 (mobile)
  const afterCode = normalized.slice(4); // removes "+972"
  if (afterCode[0] !== '5') {
    return { valid: false, reason: 'רק מספרים ניידים (05X) נתמכים לחיוג' };
  }
  return { valid: true, normalized };
}

/**
 * Formats E.164 for friendly display: +972-50-765-4321
 */
export function formatIsraeliPhone(e164) {
  if (!e164 || !e164.startsWith('+972')) return e164 || '';
  const digits = e164.slice(4); // 9 digits
  if (digits.length !== 9) return e164;
  // Format: +972-XX-XXX-XXXX
  return `+972-${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
}