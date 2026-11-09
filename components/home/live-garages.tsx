
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeBusinessWebsite,
  ALL_SERVICE_CATALOGUE,
} from "@/lib/service-listing";
import {
  formatHour,
  WEEKDAYS,
  type BusinessHour,
} from "@/lib/booking";

/* =========================================================
   TYPES
========================================================= */

type Service = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  pricing_type: "fixed" | "from" | "hourly" | "quote";
  duration_minutes: number | null;
  is_active: boolean;
};

type Garage = {
  id: string;
  business_name: string;
  business_description: string | null;
  address_line1: string;
  city: string;
  province: string;
  postal_code: string;
  public_email: string | null;
  public_phone: string | null;
  website: string | null;
  image_path: string | null;
  latitude: number | null;
  longitude: number | null;
  provider_services: Service[] | null;
  booking_suspended: boolean;
};

type Review = {
  provider_id: string;
  stars: number;
};

type PublicClosure = {
  block_id: string;
  provider_id: string;
  starts_at: string;
  ends_at: string;
  public_note: string;
};

/* =========================================================
   SERVICE CATEGORIES
========================================================= */

const CATEGORY_ICONS: Record<string, string> = {
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
};

const DEFAULT_OPEN_CATEGORIES = [
  "Popular",
  "Tires & wheels",
  "Mechanical repairs",
];

const SERVICE_GROUPS = Array.from(
  new Set(
    ALL_SERVICE_CATALOGUE.map(
      (service) => service.category
    )
  )
).map((category) => ({
  name: category,
  icon: CATEGORY_ICONS[category] ?? "🔧",
  services: ALL_SERVICE_CATALOGUE.filter(
    (service) => service.category === category
  ),
}));

/* =========================================================
   HELPERS
========================================================= */

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function priceLabel(service: Service) {
  if (
    service.pricing_type === "quote" ||
    service.price_cents == null
  ) {
    return "Quote";
  }

  const amount = (
    service.price_cents / 100
  ).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits:
      service.price_cents % 100 === 0 ? 0 : 2,
  });

  if (service.pricing_type === "from") {
    return `From ${amount}`;
  }

  if (service.pricing_type === "hourly") {
    return `${amount}/hr`;
  }

  return amount;
}

function closureDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function activeFixedServices(garage: Garage) {
  return (garage.provider_services ?? []).filter(
    (service) =>
      service.is_active &&
      service.pricing_type === "fixed" &&
      service.price_cents !== null &&
      service.duration_minutes !== null &&
      service.duration_minutes > 0
  );
}

/* =========================================================
   BUSINESS HOURS
========================================================= */

function BusinessHours({
  hours,
}: {
  hours: BusinessHour[];
}) {
  const [today, setToday] = useState<number | null>(
    null
  );

  useEffect(() => {
    const weekdayName = new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "America/Toronto",
        weekday: "long",
      }
    ).format(new Date());

    setToday(
      WEEKDAYS.findIndex(
        (day) =>
          day.toLowerCase() ===
          weekdayName.toLowerCase()
      )
    );
  }, []);

  return (
    <div className="rounded-[16px] border border-[#D5DFEA] bg-[#F8FAFC] p-4">
      <h4 className="text-[13px] font-extrabold text-[#344054]">
        🕒 Business hours
      </h4>

      <p className="mt-1 text-[11px] text-[#98A2B3]">
        Montreal time
      </p>

      <div className="mt-3 overflow-hidden rounded-[12px] border border-[#E4E7EC] bg-white">
        {WEEKDAYS.map((day, weekday) => {
          const entry = hours.find(
            (hour) => hour.weekday === weekday
          );

          const isToday = weekday === today;

          return (
            <div
              key={day}
              className={`flex items-center justify-between gap-2 border-b border-[#EAECF0] px-3 py-2.5 last:border-b-0 ${
                isToday
                  ? "bg-[#EDF3FA]"
                  : "bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[12px] font-bold ${
                    isToday
                      ? "text-[#315C91]"
                      : "text-[#344054]"
                  }`}
                >
                  {day}
                </span>

                {isToday && (
                  <span className="rounded-full bg-[#4771A6] px-2 py-0.5 text-[9px] font-extrabold uppercase text-white">
                    Today
                  </span>
                )}
              </div>

              {entry?.is_open ? (
                <span
                  className={`text-right text-[11px] font-semibold ${
                    isToday
                      ? "text-[#315C91]"
                      : "text-[#027A48]"
                  }`}
                >
                  {formatHour(entry.open_time)}
                  {" – "}
                  {formatHour(entry.close_time)}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-[#98A2B3]">
                  Closed
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   MULTI-SELECT SERVICE ACCORDION

   - Multiple services can be selected.
   - Each selected service gets a checkmark.
   - Selecting again removes the service.
   - Categories can expand/collapse.
========================================================= */

function ServiceCategoryAccordion({
  selectedServices,
  search,
  onToggle,
}: {
  selectedServices: string[];
  search: string;
  onToggle: (service: string) => void;
}) {
  const [openCategories, setOpenCategories] =
    useState<string[]>(
      DEFAULT_OPEN_CATEGORIES
    );

  function toggleCategory(category: string) {
    setOpenCategories((current) =>
      current.includes(category)
        ? current.filter(
            (item) => item !== category
          )
        : [...current, category]
    );
  }

  const allExpanded = SERVICE_GROUPS.every(
    (group) =>
      openCategories.includes(group.name)
  );

  const selectedNames = new Set(
    selectedServices.map(normalizeName)
  );

  const query = normalizeName(search);

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-extrabold text-[#101828]">
            Browse services by category
          </p>

          <p className="mt-1 text-[11px] text-[#667085]">
            Select all the services your vehicle needs.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setOpenCategories(
              allExpanded
                ? []
                : SERVICE_GROUPS.map(
                    (group) => group.name
                  )
            )
          }
          className="rounded-[9px] border border-[#D6E0ED] px-3 py-2 text-[11px] font-bold text-[#4771A6] transition hover:bg-[#EDF3FA]"
        >
          {allExpanded
            ? "− Collapse all"
            : "+ Expand all"}
        </button>
      </div>

      <div className="space-y-2">
        {SERVICE_GROUPS.map((group, index) => {
          const isOpen =
            openCategories.includes(group.name);

          const panelId =
            `homepage-service-category-${index}`;

          const matchingItems = group.services.filter(
            (service) =>
              !query ||
              normalizeName(service.name).includes(
                query
              )
          );

          const selectedCount =
            group.services.filter((service) =>
              selectedNames.has(
                normalizeName(service.name)
              )
            ).length;

          if (query && matchingItems.length === 0) {
            return null;
          }

          const showPanel = isOpen || Boolean(query);

          return (
            <div
              key={group.name}
              className={`overflow-hidden rounded-[14px] border transition-colors duration-200 ${
                showPanel
                  ? "border-[#BACDE4] bg-white"
                  : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#BACDE4]"
              }`}
            >
              <button
                type="button"
                aria-expanded={showPanel}
                aria-controls={panelId}
                onClick={() =>
                  toggleCategory(group.name)
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#EDF3FA] text-[20px]">
                    {group.icon}
                  </span>

                  <div className="min-w-0">
                    <span className="block text-[13px] font-extrabold text-[#101828]">
                      {group.name}
                    </span>

                    <span className="mt-0.5 block text-[11px] font-medium text-[#98A2B3]">
                      {group.services.length}{" "}
                      {group.services.length === 1
                        ? "service"
                        : "services"}

                      {selectedCount > 0 && (
                        <span className="font-bold text-[#4771A6]">
                          {" · "}
                          {selectedCount} selected
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[17px] font-bold transition-all duration-200 ${
                    showPanel
                      ? "border-[#4771A6] bg-[#4771A6] text-white"
                      : "border-[#C7D7E9] bg-white text-[#4771A6]"
                  }`}
                >
                  {showPanel ? "−" : "+"}
                </span>
              </button>

              <div
                id={panelId}
                aria-hidden={!showPanel}
                className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
                style={{
                  gridTemplateRows: showPanel
                    ? "1fr"
                    : "0fr",
                  opacity: showPanel ? 1 : 0,
                }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="flex flex-wrap gap-2 border-t border-[#EDF1F6] px-4 py-4">
                    {matchingItems.map((service) => {
                      const selected =
                        selectedNames.has(
                          normalizeName(service.name)
                        );

                      return (
                        <button
                          key={service.name}
                          type="button"
                          disabled={!showPanel}
                          aria-pressed={selected}
                          onClick={() =>
                            onToggle(service.name)
                          }
                          className={`rounded-full border px-3 py-2 text-[11px] font-bold transition-all duration-200 disabled:pointer-events-none ${
                            selected
                              ? "border-[#4771A6] bg-[#4771A6] text-white shadow-[0_3px_10px_rgba(71,113,166,0.2)]"
                              : "border-[#D0D5DD] bg-white text-[#344054] hover:border-[#4771A6] hover:bg-[#EDF3FA]"
                          }`}
                        >
                          {selected ? "✓ " : ""}
                          {service.icon}{" "}
                          {service.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function LiveGarages() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [garages, setGarages] =
    useState<Garage[]>([]);

  const [hours, setHours] =
    useState<BusinessHour[]>([]);

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [publicClosures, setPublicClosures] =
    useState<PublicClosure[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
   * Search is separate from selected services.
   * This allows selecting several services
   * without replacing the previous selection.
   */
  const [search, setSearch] = useState("");

  const [
    selectedServices,
    setSelectedServices,
  ] = useState<string[]>([]);

  /* =======================================================
     URL SEARCH PARAMETERS

     Supports:
       ?service=Battery
       ?service=Battery&service=Tire%20storage
  ======================================================= */

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const requested = params.getAll("service");

    if (requested.length === 0) return;

    const valid: string[] = [];
    let fallbackSearch = "";

    for (const name of requested) {
      const catalogueEntry =
        ALL_SERVICE_CATALOGUE.find(
          (service) =>
            normalizeName(service.name) ===
            normalizeName(name)
        );

      if (catalogueEntry) {
        if (!valid.includes(catalogueEntry.name)) {
          valid.push(catalogueEntry.name);
        }
      } else if (!fallbackSearch) {
        fallbackSearch = name;
      }
    }

    if (valid.length > 0) {
      setSelectedServices(valid);
    }

    if (fallbackSearch) {
      setSearch(fallbackSearch);
    }
  }, []);

  /* =======================================================
     LOAD GARAGES
  ======================================================= */

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const {
        data,
        error: queryError,
      } = await supabase
        .from("service_providers")
        .select(`
          id,
          business_name,
          business_description,
          address_line1,
          city,
          province,
          postal_code,
          public_email,
          public_phone,
          website,
          image_path,
          latitude,
          longitude,
          booking_suspended,
          provider_services (
            id,
            name,
            description,
            price_cents,
            pricing_type,
            duration_minutes,
            is_active
          )
        `)
        .eq("provider_type", "garage")
        .eq("status", "approved")
        .eq("is_listing_active", true)
        .eq("booking_suspended", false)
        .order("updated_at", {
          ascending: false,
        });

      if (!active) return;

      if (queryError) {
        console.error(
          "Could not load MECATREX garages:",
          queryError
        );

        setError(
          "Garage listings are temporarily unavailable."
        );

        setGarages([]);
        setLoading(false);
        return;
      }

      const approved = (
        (data ?? []) as Garage[]
      ).filter(
        (garage) =>
          activeFixedServices(garage).length > 0
      );

      setGarages(approved);

      if (approved.length > 0) {
        const ids = approved.map(
          (garage) => garage.id
        );

        const [
          hourResult,
          reviewResult,
          closureResult,
        ] = await Promise.all([
          supabase
            .from("garage_business_hours")
            .select(
              "provider_id,weekday,is_open,open_time,close_time"
            )
            .in("provider_id", ids),

          supabase
            .from("garage_reviews")
            .select("provider_id,stars")
            .in("provider_id", ids),

          supabase
            .from("garage_block_public_notes")
            .select(
              "block_id,provider_id,starts_at,ends_at,public_note"
            )
            .in("provider_id", ids)
            .gte(
              "ends_at",
              new Date().toISOString()
            )
            .order("starts_at", {
              ascending: true,
            })
            .limit(500),
        ]);

        if (!active) return;

        setHours(
          (hourResult.data ??
            []) as BusinessHour[]
        );

        setReviews(
          (reviewResult.data ??
            []) as Review[]
        );

        if (closureResult.error) {
          console.warn(
            "Could not load public closure notes:",
            closureResult.error.message
          );

          setPublicClosures([]);
        } else {
          setPublicClosures(
            (closureResult.data ??
              []) as PublicClosure[]
          );
        }
      } else {
        setHours([]);
        setReviews([]);
        setPublicClosures([]);
      }

      if (active) {
        setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [supabase]);

  /* =======================================================
     MULTI-SELECT ACTIONS
  ======================================================= */

  function toggleService(serviceName: string) {
    const normalized = normalizeName(serviceName);

    setSelectedServices((current) => {
      const exists = current.some(
        (name) =>
          normalizeName(name) === normalized
      );

      if (exists) {
        return current.filter(
          (name) =>
            normalizeName(name) !== normalized
        );
      }

      return [...current, serviceName];
    });

    // Clear the search field after picking a service.
    // This makes choosing a second service easier.
    setSearch("");
  }

  function clearAll() {
    setSelectedServices([]);
    setSearch("");
  }

  function addSearchAsService() {
    const match = ALL_SERVICE_CATALOGUE.find(
      (service) =>
        normalizeName(service.name) ===
        normalizeName(search)
    );

    if (match) {
      toggleService(match.name);
    }
  }

  /* =======================================================
     FILTERING

     IMPORTANT: All selected services must be offered
     by the SAME garage.

     Example:
       Battery + Tire storage

     Only garages offering both are displayed.
  ======================================================= */

  const query = normalizeName(search);

  const filtered = garages.filter((garage) => {
    const services = activeFixedServices(garage);

    if (selectedServices.length > 0) {
      return selectedServices.every(
        (selected) =>
          services.some(
            (service) =>
              normalizeName(service.name) ===
              normalizeName(selected)
          )
      );
    }

    if (!query) return true;

    return services.some(
      (service) =>
        normalizeName(service.name).includes(query)
    );
  });

  const exactSearchMatch =
    ALL_SERVICE_CATALOGUE.find(
      (service) =>
        normalizeName(service.name) === query
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div>
      {/* =================================================
          SEARCH & SERVICE CATEGORIES
      ================================================= */}

      <div className="mb-7 rounded-[24px] border border-[#BAC7D7] bg-white p-5 shadow-[0_5px_18px_rgba(16,24,40,0.045)] sm:p-6">
        <label
          htmlFor="service-search"
          className="block text-[21px] font-extrabold text-[#101828]"
        >
          🔎 What does your vehicle need?
        </label>

        <p className="mt-1 text-[13px] leading-6 text-[#667085]">
          Select one or multiple services and find
          garages that can handle all your needs.
        </p>

        {/* SEARCH INPUT */}

        <div className="relative mt-4">
          <input
            id="service-search"
            type="search"
            list="service-options"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                exactSearchMatch
              ) {
                event.preventDefault();
                addSearchAsService();
              }
            }}
            placeholder="Search oil change, battery, tire storage..."
            className="h-[52px] w-full rounded-[13px] border border-[#98A2B3] bg-white px-4 pr-14 text-[14px] font-semibold text-[#101828] outline-none transition focus:border-[#4771A6] focus:ring-2 focus:ring-[#4771A6]/10"
          />

          <datalist id="service-options">
            {ALL_SERVICE_CATALOGUE.map(
              (service) => (
                <option
                  key={service.name}
                  value={service.name}
                />
              )
            )}
          </datalist>

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[16px] font-bold text-[#667085] hover:bg-[#F2F4F7]"
            >
              ×
            </button>
          )}
        </div>

        {/* ADD EXACT SEARCH RESULT */}

        {exactSearchMatch && (
          <button
            type="button"
            onClick={addSearchAsService}
            className="mt-3 rounded-full border border-[#BAC7D7] bg-[#EDF3FA] px-4 py-2.5 text-[12px] font-bold text-[#315C91] hover:bg-[#DDE9F6]"
          >
            + Add {exactSearchMatch.icon}{" "}
            {exactSearchMatch.name}
          </button>
        )}

        {/* SELECTED SERVICES SUMMARY */}

        {selectedServices.length > 0 && (
          <div className="mt-5 rounded-[16px] border border-[#B6CEE9] bg-[#EDF3FA] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-extrabold text-[#101828]">
                  Your selected services
                </p>

                <p className="mt-1 text-[11px] text-[#667085]">
                  {selectedServices.length}{" "}
                  {selectedServices.length === 1
                    ? "service selected"
                    : "services selected"}
                  {" · "}
                  Showing garages offering all
                  selected services.
                </p>
              </div>

              <button
                type="button"
                onClick={clearAll}
                className="rounded-[9px] border border-[#BAC7D7] bg-white px-3 py-2 text-[11px] font-bold text-[#315C91] hover:bg-[#F8FAFC]"
              >
                Clear all
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedServices.map((name) => {
                const catalogue =
                  ALL_SERVICE_CATALOGUE.find(
                    (service) =>
                      normalizeName(service.name) ===
                      normalizeName(name)
                  );

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      toggleService(name)
                    }
                    title={`Remove ${name}`}
                    aria-label={`Remove ${name}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[#4771A6] bg-white px-3 py-2 text-[12px] font-bold text-[#315C91] transition hover:border-[#B42318] hover:text-[#B42318]"
                  >
                    <span>
                      {catalogue?.icon ?? "🔧"}
                    </span>

                    <span>{name}</span>

                    <span
                      aria-hidden="true"
                      className="text-[15px]"
                    >
                      ×
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ACCORDION */}

        <ServiceCategoryAccordion
          selectedServices={selectedServices}
          search={search}
          onToggle={toggleService}
        />

        <p className="mt-4 text-[11px] leading-5 text-[#98A2B3]">
          Select multiple services to find garages
          that offer all of them. Click a selected
          service again to remove it.
        </p>
      </div>

      {/* =================================================
          LOADING
      ================================================= */}

      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="overflow-hidden rounded-[22px] border border-[#EAECF0] bg-white"
            >
              <div className="h-[170px] animate-pulse bg-[#E9EEF5]" />

              <div className="space-y-4 p-5">
                <div className="h-6 w-2/3 animate-pulse rounded bg-[#EAECF0]" />
                <div className="h-5 w-full animate-pulse rounded bg-[#F2F4F7]" />
                <div className="h-14 animate-pulse rounded-xl bg-[#F2F4F7]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div
          role="alert"
          className="rounded-[22px] border border-[#FDA29B] bg-[#FEF3F2] p-6 text-center text-[#B42318]"
        >
          {error}
        </div>
      )}

      {/* =================================================
          GARAGE RESULTS
      ================================================= */}

      {!loading && !error && (
        <>
          {garages.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[#BAC7D7] bg-[#F8FAFC] p-8 text-center">
              <h3 className="text-[21px] font-bold text-[#101828]">
                Approved garages will appear here.
              </h3>

              <p className="mt-2 text-[13px] text-[#667085]">
                Garages appear after approval
                and publishing at least one
                fixed-price service.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-[#475467]">
                  <strong>{filtered.length}</strong>{" "}
                  {filtered.length === 1
                    ? "garage"
                    : "garages"}{" "}
                  matching your needs
                </p>

                {selectedServices.length > 1 && (
                  <span className="rounded-full bg-[#EDF3FA] px-3 py-1.5 text-[11px] font-bold text-[#315C91]">
                    ✓ All {selectedServices.length} services
                  </span>
                )}
              </div>

              {/* NO MATCHES */}

              {filtered.length === 0 && (
                <div className="mb-5 rounded-[20px] border border-dashed border-[#BAC7D7] bg-[#F8FAFC] p-7 text-center">
                  <span className="text-[32px]">
                    🔎
                  </span>

                  <h3 className="mt-3 text-[18px] font-extrabold text-[#101828]">
                    No garages match all your needs yet
                  </h3>

                  <p className="mx-auto mt-2 max-w-[450px] text-[13px] leading-6 text-[#667085]">
                    {selectedServices.length > 1
                      ? "No single garage currently lists every selected service. Try removing one service to see more options."
                      : "Try selecting another service or clearing your search."}
                  </p>

                  <button
                    type="button"
                    onClick={clearAll}
                    className="mt-4 rounded-[12px] bg-[#4771A6] px-5 py-3 text-[12px] font-bold text-white hover:bg-[#315C91]"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {/* GARAGE CARDS */}

              <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((garage) => {
                  const services =
                    activeFixedServices(garage);

                  /*
                   * Show selected services first.
                   * For example Battery and Tire storage
                   * will both appear on the garage card.
                   */
                  const matched =
                    selectedServices.length > 0
                      ? selectedServices
                          .map((name) =>
                            services.find(
                              (service) =>
                                normalizeName(
                                  service.name
                                ) ===
                                normalizeName(name)
                            )
                          )
                          .filter(
                            (
                              item
                            ): item is Service =>
                              item !== undefined
                          )
                      : query
                      ? services.filter(
                          (service) =>
                            normalizeName(
                              service.name
                            ).includes(query)
                        )
                      : services;

                  const displayed = matched.slice(
                    0,
                    selectedServices.length > 0 ? 3 : 2
                  );

                  const chosen =
                    matched[0] ?? services[0];

                  const garageReviews =
                    reviews.filter(
                      (review) =>
                        review.provider_id ===
                        garage.id
                    );

                  const average =
                    garageReviews.length > 0
                      ? (
                          garageReviews.reduce(
                            (total, review) =>
                              total + review.stars,
                            0
                          ) /
                          garageReviews.length
                        ).toFixed(1)
                      : null;

                  const imageUrl =
                    garage.image_path
                      ? supabase.storage
                          .from("garage-images")
                          .getPublicUrl(
                            garage.image_path
                          ).data.publicUrl
                      : "";

                  const garageHours =
                    hours.filter(
                      (hour) =>
                        hour.provider_id ===
                        garage.id
                    );

                  const closures =
                    publicClosures
                      .filter(
                        (closure) =>
                          closure.provider_id ===
                          garage.id
                      )
                      .slice(0, 6);

                  const website =
                    normalizeBusinessWebsite(
                      garage.website ?? ""
                    );

                  return (
                    <article
                      key={garage.id}
                      className="min-w-0 overflow-hidden rounded-[23px] border border-[#E4E7EC] bg-white shadow-[0_8px_28px_rgba(16,24,40,0.045)] transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(16,24,40,0.10)]"
                    >
                      {/* GARAGE IMAGE */}

                      <div className="relative h-[175px] overflow-hidden bg-gradient-to-br from-[#14263A] to-[#4771A6]">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt={`${garage.business_name} garage`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[55px]">
                            🔧
                          </div>
                        )}

                        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold text-[#101828] shadow-sm">
                          ✓ Approved MECATREX garage
                        </span>
                      </div>

                      {/* GARAGE DETAILS */}

                      <div className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="text-[22px] font-extrabold tracking-tight text-[#101828]">
                            {garage.business_name}
                          </h3>

                          {average && (
                            <span className="rounded-full bg-[#FFFAEB] px-2.5 py-1.5 text-[11px] font-bold text-[#92400E]">
                              ⭐ {average}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[#667085]">
                          📍 {garage.address_line1},{" "}
                          {garage.city},{" "}
                          {garage.province}{" "}
                          {garage.postal_code}
                        </p>

                        {garage.business_description && (
                          <p className="mt-2 line-clamp-1 text-[12px] text-[#667085]">
                            {garage.business_description}
                          </p>
                        )}

                        {/* MATCHED SERVICES */}

                        <div className="mt-4 rounded-[15px] bg-[#F8FAFC] p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#98A2B3]">
                              {selectedServices.length > 0
                                ? "Your matching services"
                                : "Services & prices"}
                            </p>

                            <span className="text-[10px] font-bold text-[#4771A6]">
                              {services.length} listed
                            </span>
                          </div>

                          <div className="space-y-2">
                            {displayed.map(
                              (service) => {
                                const catalogue =
                                  ALL_SERVICE_CATALOGUE.find(
                                    (item) =>
                                      normalizeName(
                                        item.name
                                      ) ===
                                      normalizeName(
                                        service.name
                                      )
                                  );

                                return (
                                  <div
                                    key={service.id}
                                    className="flex items-start justify-between gap-2 rounded-[10px] bg-white px-3 py-2.5"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-[12px] font-bold text-[#101828]">
                                        {catalogue?.icon ??
                                          "🔧"}{" "}
                                        {service.name}
                                      </p>

                                      <p className="text-[10px] text-[#98A2B3]">
                                        Approx.{" "}
                                        {
                                          service.duration_minutes
                                        }{" "}
                                        min
                                      </p>
                                    </div>

                                    <span className="shrink-0 text-[12px] font-bold text-[#4771A6]">
                                      {priceLabel(
                                        service
                                      )}
                                    </span>
                                  </div>
                                );
                              }
                            )}
                          </div>

                          {matched.length >
                            displayed.length && (
                            <p className="mt-2 text-[11px] font-semibold text-[#667085]">
                              +{" "}
                              {matched.length -
                                displayed.length}{" "}
                              more matching services
                            </p>
                          )}

                          {selectedServices.length >
                            1 && (
                            <div className="mt-3 rounded-[9px] bg-[#ECFDF3] px-3 py-2">
                              <p className="text-[11px] font-bold text-[#027A48]">
                                ✓ Offers all{" "}
                                {
                                  selectedServices.length
                                }{" "}
                                selected services
                              </p>
                            </div>
                          )}
                        </div>

                        {/* PUBLIC CLOSURES */}

                        {closures.length > 0 && (
                          <p className="mt-3 rounded-xl bg-[#FFFAEB] px-3 py-2.5 text-[11px] font-semibold text-[#92400E]">
                            📢 Upcoming closure:{" "}
                            {closureDate(
                              closures[0].starts_at
                            )}
                            {" · "}
                            {
                              closures[0]
                                .public_note
                            }
                          </p>
                        )}

                        {/* BOOK BUTTON */}

                        <Link
                          href={`/book/${garage.id}?service=${encodeURIComponent(
                            chosen.id
                          )}`}
                          className="mt-4 flex w-full items-center justify-center rounded-[13px] bg-[#4771A6] px-4 py-3.5 text-[14px] font-extrabold text-white transition hover:bg-[#315C91]"
                        >
                          📅 Book this garage →
                        </Link>

                        <p className="mt-2 text-center text-[10px] text-[#98A2B3]">
                          Live availability · fixed CAD price
                          {selectedServices.length > 1 &&
                            " · Book services individually"}
                        </p>

                        {/* EXPANDABLE BUSINESS DETAILS */}

                        <details className="group mt-4 border-t border-[#E4E7EC] pt-3">
                          <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-bold text-[#315C91] [&::-webkit-details-marker]:hidden">
                            <span>
                              View business details
                            </span>

                            <span className="text-[18px] transition-transform group-open:rotate-180">
                              ⌄
                            </span>
                          </summary>

                          <div className="mt-4 space-y-4">
                            {garage.business_description && (
                              <p className="text-[12px] leading-5 text-[#667085]">
                                {
                                  garage.business_description
                                }
                              </p>
                            )}

                            <BusinessHours
                              hours={garageHours}
                            />

                            {closures.length > 0 && (
                              <div className="rounded-[15px] border border-[#FEC84B] bg-[#FFFAEB] p-4">
                                <h4 className="text-[12px] font-extrabold text-[#92400E]">
                                  Upcoming closures
                                </h4>

                                {closures.map(
                                  (closure) => (
                                    <div
                                      key={
                                        closure.block_id
                                      }
                                      className="mt-3 border-t border-[#FDE68A] pt-3 first:border-t-0 first:pt-0"
                                    >
                                      <p className="text-[11px] font-bold text-[#92400E]">
                                        {closureDate(
                                          closure.starts_at
                                        )}
                                      </p>

                                      <p className="mt-1 whitespace-pre-wrap break-words text-[12px] text-[#744210]">
                                        {
                                          closure.public_note
                                        }
                                      </p>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            {website && (
                              <a
                                href={website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block break-all text-[12px] font-bold text-[#315C91] underline"
                              >
                                🌐 Visit website
                              </a>
                            )}

                            {garage.public_phone && (
                              <a
                                href={`tel:${garage.public_phone.replace(
                                  /[^\d+]/g,
                                  ""
                                )}`}
                                className="block text-[12px] font-bold text-[#315C91] underline"
                              >
                                📞{" "}
                                {
                                  garage.public_phone
                                }
                              </a>
                            )}

                            {garage.public_email && (
                              <a
                                href={`mailto:${garage.public_email}`}
                                className="block break-all text-[12px] font-bold text-[#315C91] underline"
                              >
                                ✉️{" "}
                                {
                                  garage.public_email
                                }
                              </a>
                            )}
                          </div>
                        </details>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
