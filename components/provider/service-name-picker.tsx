
"use client";

import { useState } from "react";
import { ALL_SERVICE_CATALOGUE } from "@/lib/service-listing";
import { TOWING_APPLICATION_SERVICES } from "@/lib/provider-application";

type ProviderType = "garage" | "towing";

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

const TOWING_CATALOGUE = TOWING_APPLICATION_SERVICES.map((name) => ({
  name,
  icon: TOWING_SERVICE_DETAILS[name]?.icon ?? "🚛",
  category: TOWING_SERVICE_DETAILS[name]?.category ?? "Towing services",
}));

export default function ServiceNamePicker({
  label,
  value,
  onChange,
  providerType = "garage",
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  providerType?: ProviderType;
}) {
  const catalogue = providerType === "towing" ? TOWING_CATALOGUE : ALL_SERVICE_CATALOGUE;
  const isPreset = (name: string) =>
    catalogue.some((preset) => preset.name === name);

  const [custom, setCustom] = useState(
    Boolean(value && !isPreset(value))
  );

  const selected = custom
    ? "other"
    : isPreset(value)
    ? value
    : "";

  const selectedService = catalogue.find(
    (service) => service.name === value
  );

  const categories = [
    ...new Set(
      catalogue.map((service) => service.category)
    ),
  ];

  return (
    <div>
      <label className="block">
        <span className="mb-2 block text-[14px] font-bold text-[#101828]">
          {label}
        </span>

        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[12px] bg-[#EDF3FA] text-[26px]"
          >
            {selectedService?.icon ?? (providerType === "towing" ? "🚛" : "🔧")}
          </span>

          <select
            value={selected}
            required
            onChange={(event) => {
              const next = event.target.value;

              if (next === "other") {
                setCustom(true);
                onChange("");
              } else {
                setCustom(false);
                onChange(next);
              }
            }}
            className="h-[48px] min-w-0 w-full rounded-[13px] border border-[#667085] bg-white px-3 text-[14px] font-semibold outline-none focus:border-[#4771A6]"
          >
            <option value="">{providerType === "towing" ? "Select a towing service" : "Select a service"}</option>

            {categories.map((category) => (
              <optgroup key={category} label={category}>
                {catalogue.filter(
                  (service) => service.category === category
                ).map((service) => (
                  <option
                    key={service.name}
                    value={service.name}
                  >
                    {service.icon} {service.name}
                  </option>
                ))}
              </optgroup>
            ))}

            <option value="other">
              ✨ Other service (custom)
            </option>
          </select>
        </div>
      </label>

      {custom && (
        <label className="mt-3 block">
          <span className="sr-only">
            Custom service name
          </span>

          <input
            required
            maxLength={100}
            value={value}
            onChange={(event) =>
              onChange(event.target.value)
            }
            placeholder="Enter your service"
            className="h-[48px] w-full rounded-[13px] border border-[#667085] bg-white px-4 text-[14px] outline-none focus:border-[#4771A6]"
          />
        </label>
      )}
    </div>
  );
}
