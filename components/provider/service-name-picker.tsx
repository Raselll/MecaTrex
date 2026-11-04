"use client";

import { useState } from "react";
import { COMMON_SERVICES, SERVICE_CATALOGUE } from "@/lib/service-listing";

export default function ServiceNamePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
}) {
  const isPreset = (name: string) => COMMON_SERVICES.some((preset) => preset === name);
  const [custom, setCustom] = useState(Boolean(value && !isPreset(value)));
  const selected = custom ? "other" : isPreset(value) ? value : "";
  const selectedService = SERVICE_CATALOGUE.find((service) => service.name === value);

  return (
    <div>
      <label className="block">
        <span className="mb-2 block text-[14px] font-bold text-[#101828]">{label}</span>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[12px] bg-[#EDF3FA] text-[27px]">
            {selectedService?.icon ?? "🔧"}
          </span>
          <select
          value={selected}
          required
          onChange={(event) => {
            if (event.target.value === "other") {
              setCustom(true);
              onChange("");
            } else {
              setCustom(false);
              onChange(event.target.value);
            }
          }}
          className="h-[48px] min-w-0 w-full rounded-[13px] border border-[#667085] bg-white px-3 text-[14px] font-semibold outline-none focus:border-[#4771A6]"
        >
          <option value="">Select a service</option>
          {SERVICE_CATALOGUE.map((service) => <option key={service.name} value={service.name}>{service.icon}  {service.name}</option>)}
          <option value="other">✨ Other service (custom)</option>
          </select>
        </div>
      </label>
      {custom && (
        <label className="mt-3 block">
          <span className="sr-only">Custom service name</span>
          <input
            required
            maxLength={100}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Enter your service"
            className="h-[48px] w-full rounded-[13px] border border-[#667085] bg-white px-4 text-[14px] outline-none focus:border-[#4771A6]"
          />
        </label>
      )}
    </div>
  );
}
