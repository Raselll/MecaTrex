
import { ALL_SERVICE_CATALOGUE } from "@/lib/service-listing";

export const GARAGE_APPLICATION_SERVICES =
  ALL_SERVICE_CATALOGUE.map((service) => service.name);

export const TOWING_APPLICATION_SERVICES = [
  "Local towing",
  "Long-distance towing",
  "Roadside assistance",
  "Battery boost",
  "Flat tire assistance",
  "Vehicle recovery",
  "Accident recovery",
  "Emergency towing",
  "Motorcycle towing",
  "Flatbed towing",
  "Vehicle transport",
  "Winch-out service",
  "Lockout assistance",
  "Fuel delivery",
] as const;

export function applicationServiceOptions(
  type: "garage" | "towing"
): readonly string[] {
  return type === "garage"
    ? GARAGE_APPLICATION_SERVICES
    : TOWING_APPLICATION_SERVICES;
}

export function parseApplicationServices(
  raw: string,
  type: "garage" | "towing"
): string[] | null {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  const options = applicationServiceOptions(type);

  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > options.length + 1 ||
    !value.every(
      (service) =>
        typeof service === "string" &&
        service.trim().length > 0 &&
        service.trim().length <= 100
    )
  ) {
    return null;
  }

  const cleaned = value.map((service: string) =>
    service.trim()
  );

  if (
    new Set(cleaned.map((service) => service.toLowerCase()))
      .size !== cleaned.length
  ) {
    return null;
  }

  const custom = cleaned.filter(
    (service) => !options.includes(service)
  );

  return custom.length <= 1 ? cleaned : null;
}
