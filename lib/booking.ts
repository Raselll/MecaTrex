export const GARAGE_TIME_ZONE = "America/Toronto";
export const BOOKING_CANCEL_LIMIT = 3;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type BusinessHour = {
  provider_id: string;
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

export type GarageBooking = {
  id: string;
  provider_id: string;
  service_id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  vehicle_description: string;
  garage_name: string;
  garage_address: string;
  garage_phone: string | null;
  garage_email: string | null;
  service_name: string;
  duration_minutes: number;
  price_cents: number;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "client_cancelled" | "provider_cancelled";
  note: string;
  created_at: string;
};

export type CalendarBlock = {
  id: string;
  provider_id: string;
  starts_at: string;
  ends_at: string;
  kind: "walk_in" | "unavailable";
  label: string;
};

export const ACCENT_COLORS = {
  blue: { name: "Classic blue", hex: "#4771A6", soft: "#EDF3FA" },
  teal: { name: "Deep teal", hex: "#157A76", soft: "#E9F8F6" },
  violet: { name: "Calm violet", hex: "#7048A6", soft: "#F4EEFB" },
  slate: { name: "Dark slate", hex: "#344054", soft: "#F2F4F7" },
  rose: { name: "Berry rose", hex: "#963F62", soft: "#FFF0F5" },
  amber: { name: "Copper amber", hex: "#92501E", soft: "#FFF4E5" },
} as const;

export type AccentColor = keyof typeof ACCENT_COLORS;

export function montrealDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GARAGE_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const p = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

export function plusCalendarMonths(isoDate: string, months: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export function formatMontrealDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: GARAGE_TIME_ZONE,
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(value));
}

export function formatMontrealTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: GARAGE_TIME_ZONE,
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(value));
}

export function formatPriceCents(cents: number) {
  return (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

export function formatHour(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const d = new Date(2000, 0, 1, hour, minute);
  return new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}
