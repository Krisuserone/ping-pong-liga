/** All dates and times are shown in Slovenian format. */
export const LOCALE = 'sl-SI'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Local calendar date as YYYY-MM-DD. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayIso(now = new Date()): string {
  return toIsoDate(now)
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toIsoDate(new Date(y, m - 1, d + days))
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(iso: string): string {
  return parseIso(iso).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatShortDate(iso: string): string {
  return parseIso(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
}

/** "Danes", "Včeraj" or the full date. */
export function dayLabel(iso: string, today = todayIso()): string {
  if (iso === today) return 'Danes'
  if (iso === addDays(today, -1)) return 'Včeraj'
  return formatDate(iso)
}

export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Groups items by a date key, keeping the incoming order (newest first). */
export function groupByDate<T>(items: T[], key: (item: T) => string): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = []
  for (const item of items) {
    const date = key(item)
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.items.push(item)
    else groups.push({ date, items: [item] })
  }
  return groups
}

/** Calendar date of a timestamp, e.g. "15. okt. 2026". */
export function formatDay(ts: string): string {
  return new Date(ts).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Numeric Slovenian date, e.g. "15. 10. 2026". */
export function formatNumericDate(iso: string): string {
  return parseIso(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'numeric', year: 'numeric' })
}
