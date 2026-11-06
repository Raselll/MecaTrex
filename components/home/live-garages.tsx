"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { normalizeBusinessWebsite, SERVICE_CATALOGUE } from "@/lib/service-listing";
import { formatHour, WEEKDAYS, type BusinessHour } from "@/lib/booking";

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

function priceLabel(service: Service) {
  if (service.pricing_type === "quote" || service.price_cents == null) return "Quote";
  const dollars = (service.price_cents / 100).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: service.price_cents % 100 === 0 ? 0 : 2,
  });
  if (service.pricing_type === "from") return `From ${dollars}`;
  if (service.pricing_type === "hourly") return `${dollars}/hr`;
  return dollars;
}

export default function LiveGarages() {
  const supabase = useMemo(() => createClient(), []);
  const [garages, setGarages] = useState<Garage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [reviews, setReviews] = useState<{provider_id:string;stars:number}[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("service");
    if (q) setSearch(q);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
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
        .order("updated_at", { ascending: false });

      if (!active) return;

      if (queryError) {
        console.error("Could not load MECATREX garages:", queryError);
        setError("Garage listings are temporarily unavailable.");
        setGarages([]);
      } else {
        const approved = ((data ?? []) as Garage[]).filter((garage) =>
          (garage.provider_services ?? []).some(
            (service) => service.is_active && service.pricing_type === "fixed" && service.price_cents !== null && service.duration_minutes !== null && service.duration_minutes > 0
          )
        );
        setGarages(approved);
        if (approved.length > 0) {
          const ids = approved.map((garage) => garage.id);
          const [hourResult, reviewResult] = await Promise.all([
            supabase.from("garage_business_hours").select("provider_id,weekday,is_open,open_time,close_time").in("provider_id", ids),
            supabase.from("garage_reviews").select("provider_id,stars").in("provider_id", ids),
          ]);
          if (active) {
            setHours((hourResult.data ?? []) as BusinessHour[]);
            setReviews((reviewResult.data ?? []) as {provider_id:string;stars:number}[]);
          }
        }
      }
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const query = search.trim().toLowerCase();
  const filtered = garages.filter((garage) =>
    !query || (garage.provider_services ?? []).some((service) => service.is_active && service.pricing_type === "fixed" && service.name.toLowerCase().includes(query))
  );

  if (loading) {
    return (
      <div className="grid gap-7 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="overflow-hidden rounded-[30px] border border-[#EAECF0] bg-white">
            <div className="h-[230px] animate-pulse bg-[#E9EEF5]" />
            <div className="space-y-4 p-8">
              <div className="h-7 w-2/3 animate-pulse rounded bg-[#EAECF0]" />
              <div className="h-5 w-full animate-pulse rounded bg-[#F2F4F7]" />
              <div className="h-20 animate-pulse rounded-[16px] bg-[#F2F4F7]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-[#FECACA] bg-[#FEF2F2] px-7 py-8 text-center text-[#991B1B]">
        <p className="font-bold">{error}</p>
        <p className="mt-2 text-[14px]">Please try again shortly.</p>
      </div>
    );
  }

  if (garages.length === 0) {
    return (
      <div className="rounded-[30px] border border-dashed border-[#C9D6E5] bg-[#F8FAFC] px-8 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EDF3FA] text-[30px]">🔧</div>
        <h3 className="mt-5 text-[24px] font-bold text-[#101828]">Approved garages will appear here.</h3>
        <p className="mx-auto mt-3 max-w-[620px] text-[16px] leading-7 text-[#667085]">
          Garages appear after approval and once at least one service has a confirmed fixed price.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 rounded-[24px] border border-[#BAC7D7] bg-white p-6 shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
        <label htmlFor="service-search" className="block text-[20px] font-extrabold text-[#101828]">🔎 What does your vehicle need?</label>
        <p className="mt-1 text-[13px] text-[#667085]">Enter a service to see only garages that offer it, with their fixed prices.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input id="service-search" type="search" list="service-options" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Oil change, tire service, brakes…"
            className="h-[55px] min-w-[200px] flex-1 rounded-[14px] border border-[#98A2B3] px-4 text-[16px] font-semibold text-[#101828] outline-none focus:border-[#4771A6]" />
          <datalist id="service-options">{SERVICE_CATALOGUE.map((service) => <option key={service.name} value={service.name} />)}</datalist>
          {search && <button type="button" onClick={() => setSearch("")} className="rounded-[12px] border border-[#BAC7D7] px-5 py-3 text-[13px] font-bold text-[#315C91]">Clear</button>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SERVICE_CATALOGUE.map((service) => <button key={service.name} type="button" aria-pressed={search === service.name}
            onClick={() => setSearch((current) => current === service.name ? "" : service.name)}
            className={`rounded-full border px-3 py-2 text-[12px] font-bold transition ${search === service.name ? "border-[#4771A6] bg-[#4771A6] text-white" : "border-[#D0D5DD] bg-[#F8FAFC] text-[#344054] hover:border-[#4771A6]"}`}>
            {service.icon} {service.name}
          </button>)}
        </div>
      </div>
      {filtered.length === 0 ? <div className="rounded-[22px] border border-dashed border-[#BAC7D7] bg-[#F8FAFC] p-8 text-center text-[15px] text-[#667085]">
        No garages currently offer <strong>{search}</strong>. Try another service.
      </div> : <p className="mb-5 text-[14px] font-semibold text-[#475467]">{filtered.length} approved {filtered.length === 1 ? "garage" : "garages"} ready to help</p>}
      <div className="grid gap-7 lg:grid-cols-3">
      {filtered.map((garage) => {
        const services = (garage.provider_services ?? []).filter(
          (service) => service.is_active && service.pricing_type === "fixed" && service.price_cents !== null && service.duration_minutes !== null && service.duration_minutes > 0
        );
        const websiteUrl = normalizeBusinessWebsite(garage.website ?? "");
        const matchedServices = query ? services.filter((service) => service.name.toLowerCase().includes(query)) : services;
        const visibleServices = matchedServices.slice(0, 4);
        const selectedService = matchedServices[0] ?? services[0];
        const garageHours = hours.filter((h) => h.provider_id === garage.id && h.is_open);
        const garageReviews = reviews.filter((r) => r.provider_id === garage.id);
        const average = garageReviews.length ? (garageReviews.reduce((sum,r) => sum + r.stars, 0) / garageReviews.length).toFixed(1) : null;
        const imageUrl = garage.image_path
          ? supabase.storage.from("garage-images").getPublicUrl(garage.image_path).data.publicUrl
          : "";

        return (
          <article
            key={garage.id}
            className="overflow-hidden rounded-[30px] border border-[#EAECF0] bg-white transition duration-300 hover:-translate-y-2 hover:shadow-[0_25px_70px_rgba(16,24,40,0.13)]"
          >
            <div className="relative h-[230px] overflow-hidden bg-gradient-to-br from-[#14263A] to-[#4771A6]">
              {imageUrl ? (
                // Public provider media comes from the Supabase garage-images bucket.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={`${garage.business_name} garage`} className="h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[72px]">🔧</div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-5 pt-14">
                <span className="inline-flex rounded-full bg-white px-3.5 py-2 text-[12px] font-bold text-[#101828] shadow-sm">
                  ✓ Approved MECATREX garage
                </span>
              </div>
            </div>

            <div className="p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[25px] font-bold tracking-[-0.02em] text-[#101828]">{garage.business_name}</h3>
                {average && <span className="rounded-full bg-[#FFFAEB] px-3 py-1.5 text-[12px] font-bold text-[#92400E]">⭐ {average} · {garageReviews.length} reviews</span>}
              </div>
              {garage.business_description && (
                <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[#667085]">{garage.business_description}</p>
              )}

              <div className="mt-5 space-y-2 text-[13px] leading-5 text-[#475467]">
                <p className="flex gap-2"><span>📍</span><span>{garage.address_line1}, {garage.city}, {garage.province} {garage.postal_code}</span></p>
                {garage.public_phone && (
                  <p className="flex items-start gap-2">
                    <span aria-hidden="true">📞</span>
                    <a href={`tel:${garage.public_phone.replace(/[^\d+]/g, "")}`}
                       aria-label={`Call ${garage.business_name} at ${garage.public_phone}`}
                       className="font-bold text-[#315C91] underline underline-offset-2 transition hover:text-[#101828]">
                      {garage.public_phone}
                    </a>
                  </p>
                )}
                {garage.public_email && (
                  <p className="flex items-start gap-2">
                    <span aria-hidden="true">✉️</span>
                    <a href={`mailto:${garage.public_email}?subject=${encodeURIComponent("MECATREX service inquiry")}`}
                       aria-label={`Email ${garage.business_name}`}
                       className="break-all font-bold text-[#315C91] underline underline-offset-2 transition hover:text-[#101828]">
                      {garage.public_email}
                    </a>
                  </p>
                )}
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-bold text-[#4771A6] underline underline-offset-2 hover:text-[#315C91]"
                  >
                    <span aria-hidden="true">🌐</span> Visit garage website <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>

              <div className="mt-6 rounded-[20px] bg-[#F8FAFC] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">Services & prices</p>
                  <span className="text-[12px] font-semibold text-[#4771A6]">{matchedServices.length} listed</span>
                </div>
                {visibleServices.length > 0 ? (
                  <div className="space-y-2.5">
                    {visibleServices.map((service) => (
                      <div key={service.id} className="flex items-start justify-between gap-4 rounded-[12px] bg-white px-3.5 py-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate text-[13px] font-bold text-[#101828]">
                              <span aria-hidden="true">{SERVICE_CATALOGUE.find((item) => item.name === service.name)?.icon ?? "🔧"}</span>
                              <span className="truncate">{service.name}</span>
                            </p>
                          {service.duration_minutes && (
                            <p className="mt-0.5 text-[11px] text-[#98A2B3]">Approx. {service.duration_minutes} min</p>
                          )}
                        </div>
                        <p className="shrink-0 text-[13px] font-bold text-[#4771A6]">{priceLabel(service)}</p>
                      </div>
                    ))}
                    {matchedServices.length > visibleServices.length && (
                      <p className="px-1 pt-1 text-[12px] font-semibold text-[#667085]">+ {matchedServices.length - visibleServices.length} more services</p>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#667085]">Contact this garage for a service quote.</p>
                )}
              </div>

              <div className="mt-5 rounded-[14px] border border-[#D5DFEA] bg-[#F8FAFC] p-4">
                <p className="text-[12px] font-extrabold text-[#344054]">🕒 Business hours (Montreal)</p>
                {garageHours.length ? <p className="mt-2 text-[12px] leading-5 text-[#667085]">{garageHours.map((h) => `${WEEKDAYS[h.weekday].slice(0,3)} ${formatHour(h.open_time)}–${formatHour(h.close_time)}`).join(" · ")}</p>
                : <p className="mt-2 text-[12px] font-semibold text-[#92400E]">Hours not published yet — contact the garage</p>}
              </div>
              <div className="mt-5 space-y-3">
                <Link
                  href={`/book/${garage.id}?service=${encodeURIComponent(selectedService.id)}`}
                  className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#4771A6] px-6 py-4 text-[17px] font-bold text-white shadow-[0_8px_22px_rgba(71,113,166,0.2)] transition hover:bg-[#315C91]"
                >
                  📅 Book this garage →
                </Link>
                <p className="text-center text-[11px] text-[#667085]">Live availability · fixed price · pay at garage</p>
                <div className="grid grid-cols-2 gap-3">
                  {garage.public_phone ? (
                    <a href={`tel:${garage.public_phone.replace(/[^\d+]/g, "")}`} className="rounded-[13px] border border-[#D0D5DD] px-3 py-3 text-center text-[13px] font-bold text-[#344054] hover:bg-[#F9FAFB]">Call garage</a>
                  ) : <span className="rounded-[13px] bg-[#F2F4F7] px-3 py-3 text-center text-[13px] text-[#98A2B3]">No phone</span>}
                  {garage.public_email ? (
                    <a href={`mailto:${garage.public_email}?subject=${encodeURIComponent("MECATREX service inquiry")}`} className="rounded-[13px] border border-[#D0D5DD] px-3 py-3 text-center text-[13px] font-bold text-[#344054] hover:bg-[#F9FAFB]">Email garage</a>
                  ) : <span className="rounded-[13px] bg-[#F2F4F7] px-3 py-3 text-center text-[13px] text-[#98A2B3]">No email</span>}
                </div>
              </div>
            </div>
          </article>
        );
      })}
      </div>
    </div>
  );
}
