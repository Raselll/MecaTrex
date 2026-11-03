"use client";

import { useState } from "react";
import { COMMON_SERVICES } from "@/lib/service-listing";

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

  return (
    <div>
      <label className="block">
        <span className="mb-2 block text-[12px] font-bold text-[#344054]">{label}</span>
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
          className="h-[48px] w-full rounded-[13px] border border-[#D0D5DD] bg-white px-3 text-[14px] font-semibold outline-none focus:border-[#4771A6]"
        >
          <option value="">Select a service</option>
          {COMMON_SERVICES.map((name) => <option key={name} value={name}>{name}</option>)}
          <option value="other">Other service (custom)</option>
        </select>
      </label>
      {custom && (
        <label className="mt-2 block">
          <span className="sr-only">Custom service name</span>
          <input
            required
            maxLength={100}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Enter your service"
            className="h-[48px] w-full rounded-[13px] border border-[#D0D5DD] bg-white px-4 text-[14px] outline-none focus:border-[#4771A6]"
          />
        </label>
      )}
    </div>
  );
}
