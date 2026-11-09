
export const SERVICE_CATALOGUE = [
  {
    name: "Oil change",
    icon: "🛢️",
    description: "Oil and routine engine maintenance.",
  },
  {
    name: "Tire service",
    icon: "🛞",
    description: "Tire installation, rotation, balancing and repair.",
  },
  {
    name: "Brake service",
    icon: "🛑",
    description: "Brake inspection, pads, rotors and repairs.",
  },
  {
    name: "Battery",
    icon: "🔋",
    description: "Battery testing, diagnosis and replacement.",
  },
  {
    name: "Diagnostics",
    icon: "🔧",
    description: "Check engine lights, noises and electrical faults.",
  },
  {
    name: "Inspection & maintenance",
    icon: "🔍",
    description: "General inspections and preventive maintenance.",
  },
] as const;

export const EXTENDED_SERVICES = [
  {
    name: "Wheel alignment",
    icon: "📐",
    description: "Wheel alignment and steering geometry.",
    category: "Tires & wheels",
  },
  {
    name: "Seasonal tire change",
    icon: "❄️",
    description: "Summer and winter tire changeovers.",
    category: "Tires & wheels",
  },
  {
    name: "Tire storage",
    icon: "🏬",
    description: "Seasonal storage for tires and wheels.",
    category: "Tires & wheels",
  },
  {
    name: "Wheel & rim repair",
    icon: "⚙️",
    description: "Repair or restoration of damaged wheels and rims.",
    category: "Tires & wheels",
  },
  {
    name: "Engine repair",
    icon: "🧰",
    description: "Engine diagnosis, repair and replacement.",
    category: "Mechanical repairs",
  },
  {
    name: "Transmission repair",
    icon: "⚙️",
    description: "Transmission servicing, repair and replacement.",
    category: "Mechanical repairs",
  },
  {
    name: "Suspension & steering",
    icon: "🛠️",
    description: "Shocks, struts, tie rods and steering repairs.",
    category: "Mechanical repairs",
  },
  {
    name: "Exhaust & muffler",
    icon: "💨",
    description: "Exhaust systems, leaks and muffler replacement.",
    category: "Mechanical repairs",
  },
  {
    name: "Radiator & cooling system",
    icon: "🌡️",
    description: "Radiators, coolant systems and overheating issues.",
    category: "Mechanical repairs",
  },
  {
    name: "Fuel system repair",
    icon: "⛽",
    description: "Fuel pumps, injectors and related repairs.",
    category: "Mechanical repairs",
  },
  {
    name: "Clutch repair",
    icon: "🔩",
    description: "Manual transmission clutch inspection and repair.",
    category: "Mechanical repairs",
  },
  {
    name: "Air conditioning & heating",
    icon: "❄️",
    description: "Vehicle A/C, ventilation and cabin heating.",
    category: "Climate control",
  },
  {
    name: "Electrical system repair",
    icon: "⚡",
    description: "Vehicle wiring, electrical faults and components.",
    category: "Electrical & technology",
  },
  {
    name: "Alternator & starter",
    icon: "🔌",
    description: "Charging and engine-starting system repairs.",
    category: "Electrical & technology",
  },
  {
    name: "Lighting repair",
    icon: "💡",
    description: "Headlights, taillights and signal lights.",
    category: "Electrical & technology",
  },
  {
    name: "ADAS calibration",
    icon: "📡",
    description: "Camera, radar and driver-assistance calibration.",
    category: "Electrical & technology",
  },
  {
    name: "Hybrid & EV service",
    icon: "🔋",
    description: "Hybrid and electric vehicle diagnosis and service.",
    category: "Electrical & technology",
  },
  {
    name: "Collision & body repair",
    icon: "🚘",
    description: "Collision damage and vehicle body restoration.",
    category: "Bodywork & glass",
  },
  {
    name: "Door & panel repair",
    icon: "🚪",
    description: "Repair or replacement of damaged car doors and panels.",
    category: "Bodywork & glass",
  },
  {
    name: "Dent & scratch repair",
    icon: "🪄",
    description: "Dents, scratches and cosmetic body damage.",
    category: "Bodywork & glass",
  },
  {
    name: "Bumper repair",
    icon: "🚗",
    description: "Bumper repair, painting and replacement.",
    category: "Bodywork & glass",
  },
  {
    name: "Auto painting",
    icon: "🎨",
    description: "Automotive painting and paint restoration.",
    category: "Bodywork & glass",
  },
  {
    name: "Windshield & auto glass",
    icon: "🪟",
    description: "Windshield chips, cracks and glass replacement.",
    category: "Bodywork & glass",
  },
  {
    name: "Window tinting",
    icon: "😎",
    description: "Automotive window tinting and film installation.",
    category: "Bodywork & glass",
  },
  {
    name: "Car wrapping",
    icon: "🎨",
    description: "Vinyl wraps, colour changes and custom graphics.",
    category: "Appearance & protection",
  },
  {
    name: "Car wash",
    icon: "🧼",
    description: "Exterior washing and vehicle cleaning.",
    category: "Appearance & protection",
  },
  {
    name: "Interior & exterior detailing",
    icon: "✨",
    description: "Deep cleaning, polishing and vehicle detailing.",
    category: "Appearance & protection",
  },
  {
    name: "Rustproofing",
    icon: "🛡️",
    description: "Anti-rust treatment and winter protection.",
    category: "Appearance & protection",
  },
  {
    name: "Ceramic coating",
    icon: "💎",
    description: "Protective ceramic coatings for vehicle paint.",
    category: "Appearance & protection",
  },
  {
    name: "Paint protection film",
    icon: "🛡️",
    description: "Protective film against paint chips and scratches.",
    category: "Appearance & protection",
  },
  {
    name: "Undercarriage wash",
    icon: "🚿",
    description: "Underbody washing and salt removal.",
    category: "Appearance & protection",
  },
  {
    name: "Fluid service",
    icon: "🧴",
    description: "Brake, coolant, transmission and other fluids.",
    category: "Maintenance",
  },
  {
    name: "Air & cabin filters",
    icon: "🌬️",
    description: "Engine air and passenger cabin filter replacement.",
    category: "Maintenance",
  },
  {
    name: "Wiper replacement",
    icon: "🌧️",
    description: "Wiper blades and washer-system maintenance.",
    category: "Maintenance",
  },
  {
    name: "Spark plug replacement",
    icon: "⚡",
    description: "Spark plugs and ignition-system servicing.",
    category: "Maintenance",
  },
  {
    name: "Belt & hose replacement",
    icon: "🔗",
    description: "Timing, serpentine belts and vehicle hoses.",
    category: "Maintenance",
  },
  {
    name: "Pre-purchase inspection",
    icon: "📋",
    description: "Check a used vehicle before purchasing it.",
    category: "Inspections",
  },
  {
    name: "Authorized mechanical inspection",
    icon: "✅",
    description: "Official inspections where the business is authorized.",
    category: "Inspections",
  },
  {
    name: "Mobile mechanic",
    icon: "🚐",
    description: "Eligible vehicle repairs performed at your location.",
    category: "Specialty services",
  },
  {
    name: "Car key programming",
    icon: "🔑",
    description: "Vehicle keys, remotes and immobilizer programming.",
    category: "Specialty services",
  },
] as const;

export const ALL_SERVICE_CATALOGUE = [
  ...SERVICE_CATALOGUE.map((service) => ({
    ...service,
    category: "Popular",
  })),
  ...EXTENDED_SERVICES,
];

export const COMMON_SERVICES = ALL_SERVICE_CATALOGUE.map(
  (service) => service.name
);

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

export function normalizeBusinessWebsite(
  value: string
): string | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`
    );

    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname.includes(".")
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
