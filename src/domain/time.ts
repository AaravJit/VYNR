/** Calendar helpers. All periods use the device's local calendar. */

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Monday 00:00 local time of the week containing ts. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

/** ISO-8601 week key such as "2026-W48". */
export function weekKey(ts: number): string {
  const d = new Date(startOfDay(ts));
  // Thursday of this week decides the ISO year.
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + 3);
  const isoYear = d.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const jan4Dow = (jan4.getDay() + 6) % 7;
  const week1Thursday = new Date(isoYear, 0, 4 - jan4Dow + 3);
  const week = 1 + Math.round((d.getTime() - week1Thursday.getTime()) / (7 * 86400000));
  return `${isoYear}-W${pad(week)}`;
}

export function periodKey(period: 'daily' | 'weekly', ts: number): string {
  return period === 'daily' ? `D:${dayKey(ts)}` : `W:${weekKey(ts)}`;
}

export function periodStart(period: 'daily' | 'weekly', ts: number): number {
  return period === 'daily' ? startOfDay(ts) : startOfWeek(ts);
}

export function periodEnd(period: 'daily' | 'weekly', ts: number): number {
  return period === 'daily' ? addDays(startOfDay(ts), 1) : addDays(startOfWeek(ts), 7);
}

/** Longest and current streak of consecutive local days with at least one encounter. */
export function streaks(timestamps: number[], now: number): { current: number; longest: number } {
  const days = Array.from(new Set(timestamps.map(dayKey))).sort();
  if (days.length === 0) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1]!;
    const expected = dayKey(addDays(new Date(`${prev}T12:00:00`).getTime(), 1));
    run = days[i] === expected ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const today = dayKey(now);
  const yesterday = dayKey(addDays(now, -1));
  const last = days[days.length - 1];
  const current = last === today || last === yesterday ? run : 0;
  return { current, longest };
}
