export const SERVICE_CATALOGUE = [
  { name: "Oil change", icon: "🛢️", description: "Oil and routine engine maintenance." },
  { name: "Tire service", icon: "🛞", description: "Installation, rotation, balancing and repair." },
  { name: "Brake service", icon: "🛑", description: "Brake inspection, pads, rotors and repairs." },
  { name: "Battery", icon: "🔋", description: "Battery testing, diagnosis and replacement." },
  { name: "Diagnostics", icon: "🔧", description: "Check engine lights, noises and unknown problems." },
  { name: "Inspection & maintenance", icon: "🔍", description: "General inspection and preventive maintenance." },
] as const;

// Shared between the homepage and the provider dashboard to avoid inconsistent labels/icons.
export const COMMON_SERVICES = SERVICE_CATALOGUE.map((service) => service.name);
export type PricingType = "fixed" | "from" | "hourly" | "quote";

export function isCompleteService(
  name: string,
  pricing: PricingType,
  priceCents: number | null,
  durationMinutes: number | null
): boolean {
  return (
    name.trim().length > 0 &&
    pricing === "fixed" &&
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
