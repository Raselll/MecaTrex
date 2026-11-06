// Service types requested during initial business verification.
// These are application categories only: published services/prices are created after approval.
export const GARAGE_APPLICATION_SERVICES = [
  "Tire service",
  "Oil change",
  "Brake service",
  "Inspection & maintenance",
  "Diagnostics",
  "Battery",
  "Engine & transmission repair",
  "Air conditioning",
] as const;

export const TOWING_APPLICATION_SERVICES = [
  "Local towing",
  "Long-distance towing",
  "Roadside assistance",
  "Battery boost",
  "Flat tire assistance",
  "Vehicle recovery",
] as const;

export function applicationServiceOptions(type: "garage" | "towing"): readonly string[] {
  return type === "garage" ? GARAGE_APPLICATION_SERVICES : TOWING_APPLICATION_SERVICES;
}

export function parseApplicationServices(raw: string, type: "garage" | "towing"): string[] | null {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(value) || value.length === 0 || value.length > 12 ||
    !value.every((service) => typeof service === "string" &&
      service.trim().length > 0 && service.trim().length <= 100)) return null;
  const cleaned = value.map((service: string) => service.trim());
  if (new Set(cleaned.map((service) => service.toLowerCase())).size !== cleaned.length) return null;
  const options = applicationServiceOptions(type);
  const custom = cleaned.filter((service) => !options.includes(service));
  return custom.length <= 1 ? cleaned : null;
}
