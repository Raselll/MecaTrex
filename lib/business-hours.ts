/**
 * A single browser/server validator for the seven operating-hour rows.
 * Times use 24-hour HH:mm strings (including 00:00, e.g. an overnight garage).
 * A closed day is still represented with valid times and is never treated as open.
 */
export type BusinessHoursDraft = {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

const TIME_24_HOURS = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateBusinessHours(input: unknown): BusinessHoursDraft[] | null {
  if (!Array.isArray(input) || input.length !== 7) return null;

  const seen = new Set<number>();
  const result: BusinessHoursDraft[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const day = raw as Record<string, unknown>;
    if (
      typeof day.weekday !== "number" ||
      !Number.isInteger(day.weekday) ||
      day.weekday < 0 ||
      day.weekday > 6 ||
      seen.has(day.weekday) ||
      typeof day.is_open !== "boolean" ||
      typeof day.open_time !== "string" ||
      typeof day.close_time !== "string" ||
      !TIME_24_HOURS.test(day.open_time) ||
      !TIME_24_HOURS.test(day.close_time) ||
      (day.is_open && day.open_time === day.close_time)
    ) {
      return null;
    }
    seen.add(day.weekday);
    result.push({
      weekday: day.weekday,
      is_open: day.is_open,
      open_time: day.open_time,
      close_time: day.close_time,
    });
  }
  return seen.size === 7 ? result : null;
}
