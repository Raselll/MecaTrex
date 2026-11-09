"use client";

import { useMemo, useState } from "react";
import {
  ALL_SERVICE_CATALOGUE,
} from "@/lib/service-listing";
import {
  applicationServiceOptions,
} from "@/lib/provider-application";

type ProviderType = "garage" | "towing";

type ServiceOption = {
  name: string;
  icon: string;
  category: string;
};

type Props = {
  providerType: ProviderType;
  selectedServices: string[];
  onToggleService: (name: string) => void;
  otherServiceEnabled: boolean;
  onToggleOther: () => void;
  otherService: string;
  onOtherServiceChange: (value: string) => void;
};

const TOWING_GROUPS: ServiceOption[] = [
  { name: "Local towing", icon: "🚚", category: "Popular" },
  { name: "Roadside assistance", icon: "🛟", category: "Popular" },
  { name: "Battery boost", icon: "🔋", category: "Popular" },
  { name: "Flat tire assistance", icon: "🛞", category: "Popular" },
  { name: "Long-distance towing", icon: "🛣️", category: "Transport & towing" },
  { name: "Flatbed towing", icon: "🚛", category: "Transport & towing" },
  { name: "Vehicle transport", icon: "🚘", category: "Transport & towing" },
  { name: "Motorcycle towing", icon: "🏍️", category: "Transport & towing" },
  { name: "Emergency towing", icon: "🚨", category: "Recovery & emergencies" },
  { name: "Accident recovery", icon: "⚠️", category: "Recovery & emergencies" },
  { name: "Vehicle recovery", icon: "🪝", category: "Recovery & emergencies" },
  { name: "Winch-out service", icon: "⛓️", category: "Recovery & emergencies" },
  { name: "Lockout assistance", icon: "🔑", category: "Roadside support" },
  { name: "Fuel delivery", icon: "⛽", category: "Roadside support" },
];

const GROUP_ICONS: Record<string, string> = {
  Popular: "⭐",
  "Tires & wheels": "🛞",
  "Mechanical repairs": "🛠️",
  "Climate control": "❄️",
  "Electrical & technology": "⚡",
  "Bodywork & glass": "🚘",
  "Appearance & protection": "✨",
  Maintenance: "🧰",
  Inspections: "📋",
  "Specialty services": "🔑",
  "Transport & towing": "🚛",
  "Recovery & emergencies": "🚨",
  "Roadside support": "🛟",
};

export default function ServiceCategorySelector({
  providerType,
  selectedServices,
  onToggleService,
  otherServiceEnabled,
  onToggleOther,
  otherService,
  onOtherServiceChange,
}: Props) {
  const [search, setSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<string[]>(["Popular"]);

  const items = useMemo<ServiceOption[]>(() => {
    const allowed = new Set(applicationServiceOptions(providerType));
    return (providerType === "garage" ? ALL_SERVICE_CATALOGUE : TOWING_GROUPS)
      .filter((option) => allowed.has(option.name))
      .map((option) => ({
        name: option.name,
        icon: option.icon,
        category: option.category,
      }));
  }, [providerType]);

  const categories = useMemo(() => [...new Set(items.map((item) => item.category))], [items]);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleGroups = categories
    .map((category) => ({
      category,
      options: items.filter(
        (item) =>
          item.category === category &&
          (!normalizedSearch ||
            `${item.name} ${item.category}`.toLocaleLowerCase().includes(normalizedSearch))
      ),
    }))
    .filter((group) => group.options.length > 0);

  const selectedTotal = selectedServices.length + (otherServiceEnabled && otherService.trim() ? 1 : 0);

  function toggleCategory(category: string) {
    setOpenCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category]
    );
  }

  function expandAll() {
    setOpenCategories(categories);
  }

  function collapseAll() {
    setOpenCategories([]);
  }

  return (
    <fieldset className="mt-6 min-w-0">
      <legend className="text-[15px] font-extrabold text-[#101828]">
        Services you plan to offer *
      </legend>
      <p className="mt-1 text-[12px] leading-5 text-[#667085]">
        Choose the services your business provides. Categories expand only when you need them.
        Exact prices are entered after approval.
      </p>

      <div className="mt-4 rounded-[18px] border border-[#D6E0ED] bg-white p-4 sm:p-5">
        <label htmlFor="signup-service-search" className="block text-[12px] font-bold text-[#344054]">
          Find a service
        </label>
        <div className="relative mt-2">
          <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2">🔎</span>
          <input
            id="signup-service-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search oil change, rustproofing, glass..."
            className="h-[48px] w-full rounded-[12px] border border-[#BAC7D7] bg-[#F8FAFC] pl-11 pr-4 text-[13px] text-[#101828] outline-none focus:border-[#4771A6] focus:ring-2 focus:ring-[#4771A6]/10"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-[#EDF3FA] px-3 py-1.5 text-[12px] font-bold text-[#315C91]" aria-live="polite">
            {selectedTotal} {selectedTotal === 1 ? "service" : "services"} selected
          </span>
          <div className="flex gap-3">
            <button type="button" onClick={expandAll} className="text-[11px] font-bold text-[#315C91] hover:underline">
              Expand all
            </button>
            <button type="button" onClick={collapseAll} className="text-[11px] font-bold text-[#667085] hover:underline">
              Collapse all
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {visibleGroups.map(({ category, options }) => {
            const expanded = Boolean(normalizedSearch) || openCategories.includes(category);
            const selectedInCategory = options.filter((item) => selectedServices.includes(item.name)).length;
            const id = `signup-service-group-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            return (
              <section key={category} className="overflow-hidden rounded-[14px] border border-[#D7E0EB] bg-white">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={id}
                  onClick={() => toggleCategory(category)}
                  className={`flex min-h-[59px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#F3F7FC] ${expanded ? "bg-[#EDF3FA]" : "bg-[#F9FAFC]"}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-lg" aria-hidden="true">
                      {GROUP_ICONS[category] ?? "🔧"}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-extrabold text-[#101828]">{category}</span>
                      <span className="mt-0.5 block text-[11px] text-[#667085]">
                        {options.length} {options.length === 1 ? "service" : "services"}
                        {selectedInCategory > 0 ? ` · ${selectedInCategory} selected` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#C5D2E2] bg-white text-xl font-semibold text-[#315C91]" aria-hidden="true">
                    {expanded ? "−" : "+"}
                  </span>
                </button>
                {expanded && (
                  <div id={id} className="flex flex-wrap gap-2 border-t border-[#D7E0EB] p-3 sm:p-4">
                    {options.map((service) => {
                      const active = selectedServices.includes(service.name);
                      return (
                        <button
                          key={service.name}
                          type="button"
                          aria-pressed={active}
                          onClick={() => onToggleService(service.name)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-[12px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4771A6] ${
                            active
                              ? "border-[#4771A6] bg-[#4771A6] text-white"
                              : "border-[#C7D3E2] bg-white text-[#344054] hover:border-[#4771A6] hover:bg-[#F4F8FD]"
                          }`}
                        >
                          <span aria-hidden="true">{active ? "✓" : service.icon}</span>
                          {service.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
          {visibleGroups.length === 0 && (
            <p className="rounded-[12px] bg-[#F8FAFC] p-5 text-center text-[12px] text-[#667085]">
              No matching service. Try another word or choose Other below.
            </p>
          )}
        </div>

        <div className="mt-3 rounded-[14px] border border-dashed border-[#C7D3E2] bg-[#FAFBFD] p-4">
          <button
            type="button"
            aria-pressed={otherServiceEnabled}
            onClick={onToggleOther}
            className={`rounded-full border px-4 py-2.5 text-[12px] font-bold ${otherServiceEnabled ? "border-[#4771A6] bg-[#4771A6] text-white" : "border-[#C7D3E2] bg-white text-[#344054]"}`}
          >
            {otherServiceEnabled ? "✓" : "+"} ✨ Other service
          </button>
          <p className="mt-2 text-[11px] text-[#667085]">Only use this if your service is not listed above.</p>
          {otherServiceEnabled && (
            <label className="mt-3 block text-[12px] font-bold text-[#344054]">
              Describe your additional service *
              <input
                required
                value={otherService}
                maxLength={100}
                onChange={(event) => onOtherServiceChange(event.target.value)}
                placeholder="Enter your custom service"
                className="mt-2 h-[48px] w-full rounded-[12px] border border-[#C7D3E2] bg-white px-4 text-[13px] outline-none focus:border-[#4771A6]"
              />
            </label>
          )}
        </div>
      </div>

      {selectedTotal > 0 && (
        <div className="mt-4 rounded-[15px] border border-[#B9D0EA] bg-[#EDF3FA] p-4">
          <p className="mb-3 text-[12px] font-extrabold text-[#315C91]">✓ Your selected services ({selectedTotal})</p>
          <div className="flex flex-wrap gap-2">
            {selectedServices.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onToggleService(name)}
                aria-label={`Remove ${name}`}
                className="rounded-full border border-[#B8CCE2] bg-white px-3 py-2 text-[11px] font-bold text-[#315C91] transition hover:border-[#4771A6]"
              >
                {name} <span aria-hidden="true">×</span>
              </button>
            ))}
            {otherServiceEnabled && otherService.trim() && (
              <span className="rounded-full bg-white px-3 py-2 text-[11px] font-bold text-[#315C91]">
                ✨ {otherService.trim()}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-[#667085]">Click a selected service to remove it.</p>
        </div>
      )}
    </fieldset>
  );
}
