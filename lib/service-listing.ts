export const COMMON_SERVICES = [
  "Oil change",
  "Tire service",
  "Brake service",
  "Battery",
  "Diagnostics",
  "Inspection & maintenance",
] as const;

export type PricingType = "fixed" | "from" | "hourly" | "quote";

export function isCompleteService(
  name: string,
  pricing: PricingType,
  priceCents: number | null,
  durationMinutes: number | null
): boolean {
  return (
    name.trim().length > 0 &&
    (pricing === "fixed" || pricing === "from" || pricing === "hourly") &&
    priceCents !== null &&
    Number.isSafeInteger(priceCents) &&
    priceCents >= 0 &&
    durationMinutes !== null &&
    Number.isSafeInteger(durationMinutes) &&
    durationMinutes > 0
  );
}

export function normalizeBusinessWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
