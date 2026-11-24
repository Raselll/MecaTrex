import { TOWING_APPLICATION_SERVICES } from "@/lib/provider-application";

const TOWING_SERVICE_DETAILS: Record<string, { icon: string; category: string }> = {
  "Local towing": { icon: "🚚", category: "Popular" },
  "Roadside assistance": { icon: "🛟", category: "Popular" },
  "Battery boost": { icon: "🔋", category: "Popular" },
  "Flat tire assistance": { icon: "🛞", category: "Popular" },
  "Long-distance towing": { icon: "🛣️", category: "Transport & towing" },
  "Flatbed towing": { icon: "🚛", category: "Transport & towing" },
  "Vehicle transport": { icon: "🚘", category: "Transport & towing" },
  "Motorcycle towing": { icon: "🏍️", category: "Transport & towing" },
  "Emergency towing": { icon: "🚨", category: "Recovery & emergencies" },
  "Accident recovery": { icon: "⚠️", category: "Recovery & emergencies" },
  "Vehicle recovery": { icon: "🪝", category: "Recovery & emergencies" },
  "Winch-out service": { icon: "⛓️", category: "Recovery & emergencies" },
  "Lockout assistance": { icon: "🔑", category: "Roadside support" },
  "Fuel delivery": { icon: "⛽", category: "Roadside support" },
};

export const TOWING_SERVICE_CATALOGUE = TOWING_APPLICATION_SERVICES.map((name) => ({
  name,
  icon: TOWING_SERVICE_DETAILS[name]?.icon ?? "🚛",
  category: TOWING_SERVICE_DETAILS[name]?.category ?? "Towing services",
}));
