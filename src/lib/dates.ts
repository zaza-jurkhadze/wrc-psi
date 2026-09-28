export const CLINIC_TZ = "Asia/Tbilisi";
export const CLINIC_UTC_OFFSET = 4; // Georgia uses UTC+4 permanently, no DST
const OFFSET_MS = CLINIC_UTC_OFFSET * 60 * 60 * 1000;
const PLAIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Given a JS Date (stored internally as epoch UTC), derive the Tbilisi
 * (UTC+4) YYYY-MM-DD calendar day by shifting epoch forward by 4 hours
 * and reading UTC components. No dependency on Intl / ICU data.
 */
function extractClinicDayFromDate(date: Date): string {
  const shifted = new Date(date.getTime() + OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1;
  const d = shifted.getUTCDate();
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Current Tbilisi calendar day as "YYYY-MM-DD". Derived purely via
 * UTC arithmetics so result is stable regardless of server local TZ / ICU.
 */
export function todayClinicDay(): string {
  return extractClinicDayFromDate(new Date());
}

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    if (PLAIN_DATE_RE.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      const isoWithTz =
        `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}` +
        `T00:00:00+0${CLINIC_UTC_OFFSET}:00`;
      return new Date(isoWithTz);
    }
    return new Date(value);
  }
  return new Date(NaN);
}

/**
 * Convert any date-like value into Tbilisi calendar day string YYYY-MM-DD.
 * If the value is already a plain YYYY-MM-DD string, return it directly
 * (since it already represents a Tbilisi calendar day from DB / params).
 */
export function toClinicDayString(value: Date | string | number): string {
  if (typeof value === "string" && PLAIN_DATE_RE.test(value)) return value;
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return todayClinicDay();
  return extractClinicDayFromDate(d);
}

/** კლინიკის კალენდარული დღე YYYY-MM-DD (თბილისი, არა UTC). */
export function localDateISO(d: Date | string | number = new Date()): string {
  return toClinicDayString(d);
}

export function parseLocalDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return parseLocalDay(todayClinicDay());
  return new Date(Date.UTC(y, m - 1, d));
}

export function rosterDayFromParam(dateParam: string | null | undefined): Date {
  if (dateParam && PLAIN_DATE_RE.test(dateParam)) {
    return parseLocalDay(dateParam);
  }
  return parseLocalDay(todayClinicDay());
}

export function isTodayISO(iso: string): boolean {
  return toClinicDayString(iso) === todayClinicDay();
}

export function isSameCalendarDay(
  a: Date | string | number,
  b: Date | string | number = new Date(),
): boolean {
  return toClinicDayString(a) === toClinicDayString(b);
}

export function addDaysISO(iso: string, days: number): string {
  const plain = toClinicDayString(iso);
  const [y, m, d] = plain.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const ny = dt.getUTCFullYear();
  const nm = dt.getUTCMonth() + 1;
  const nd = dt.getUTCDate();
  return `${ny}-${pad2(nm)}-${pad2(nd)}`;
}

export function prevDayISO(iso: string): string {
  return addDaysISO(iso, -1);
}

export function nextDayISO(iso: string): string {
  return addDaysISO(iso, 1);
}
