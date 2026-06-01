/**
 * Tolerant date handling for the cost breakdown's month filter.
 *
 * Dates reach us in mixed formats: saved records use ISO (YYYY-MM-DD),
 * daily-summary uploads carry a YYYY-MM-DD pulled from the filename, and
 * vendor-orders uploads take whatever the file's Date column held — which may
 * be DD/MM/YYYY, DD-MM-YYYY, etc., or blank.
 *
 * Slash/dash dates are read **day-first** (DD/MM/YYYY) since this app targets a
 * non-US locale; an obvious month-first value (first part > 12) is corrected.
 */

export const UNDATED_KEY = 'undated';

/** Extract a `YYYY-MM` month key from a raw date string, or null if unparseable. */
export function monthKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const valid = (y: number, m: number) =>
    Number.isFinite(y) && y > 1900 && y < 3000 && m >= 1 && m <= 12;

  // ISO-ish: YYYY-MM-DD or YYYY/MM/DD (optionally with time)
  let m = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (m) {
    const y = +m[1];
    const mo = +m[2];
    if (valid(y, mo)) return `${y}-${String(mo).padStart(2, '0')}`;
  }

  // Day/month-first: D[/-.]M[/-.]YYYY
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    let day = +m[1];
    let mo = +m[2];
    const y = +m[3];
    // Correct an obvious month-first value (e.g. 03/15/2026).
    if (mo > 12 && day <= 12) [day, mo] = [mo, day];
    if (valid(y, mo)) return `${y}-${String(mo).padStart(2, '0')}`;
  }

  // Last resort: let the engine try (handles "Mar 15, 2026" and similar).
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }

  return null;
}

/** Human label for a month key: "2026-01" -> "Jan 2026"; UNDATED_KEY -> "Undated". */
export function monthLabel(key: string): string {
  if (key === UNDATED_KEY) return 'Undated';
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (!m) return key;
  const d = new Date(+m[1], +m[2] - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Sort month keys newest-first, with "Undated" always last.
 */
export function sortMonthKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === UNDATED_KEY) return 1;
    if (b === UNDATED_KEY) return -1;
    return b.localeCompare(a);
  });
}
