"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeBusinessWebsite, SERVICE_CATALOGUE } from "@/lib/service-listing";

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
  const [bookingGarageId, setBookingGarageId] = useState<string | null>(null);

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
        .order("updated_at", { ascending: false });

      if (!active) return;

      if (queryError) {
        console.error("Could not load MECATREX garages:", queryError);
        setError("Garage listings are temporarily unavailable.");
        setGarages([]);
      } else {
        setGarages(
          ((data ?? []) as Garage[]).filter((garage) =>
            (garage.provider_services ?? []).some(
              (service) => service.is_active && service.pricing_type === "fixed" && service.price_cents !== null && service.duration_minutes !== null && service.duration_minutes > 0
            )
          )
        );
      }
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase]);

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
    <div className="grid gap-7 lg:grid-cols-3">
      {garages.map((garage) => {
        const services = (garage.provider_services ?? []).filter(
          (service) => service.is_active && service.pricing_type === "fixed" && service.price_cents !== null && service.duration_minutes !== null && service.duration_minutes > 0
        );
        const websiteUrl = normalizeBusinessWebsite(garage.website ?? "");
        const visibleServices = services.slice(0, 4);
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
              <h3 className="text-[25px] font-bold tracking-[-0.02em] text-[#101828]">{garage.business_name}</h3>
              {garage.business_description && (
                <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[#667085]">{garage.business_description}</p>
              )}

              <div className="mt-5 space-y-2 text-[13px] leading-5 text-[#475467]">
                <p className="flex gap-2"><span>📍</span><span>{garage.address_line1}, {garage.city}, {garage.province} {garage.postal_code}</span></p>
                {garage.public_phone && <p className="flex gap-2"><span>📞</span><span>{garage.public_phone}</span></p>}
                {garage.public_email && <p className="flex gap-2"><span>✉️</span><span className="break-all">{garage.public_email}</span></p>}
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
                  <span className="text-[12px] font-semibold text-[#4771A6]">{services.length} listed</span>
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
                    {services.length > visibleServices.length && (
                      <p className="px-1 pt-1 text-[12px] font-semibold text-[#667085]">+ {services.length - visibleServices.length} more services</p>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#667085]">Contact this garage for a service quote.</p>
                )}
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  aria-expanded={bookingGarageId === garage.id}
                  aria-controls={`booking-info-${garage.id}`}
                  onClick={() => setBookingGarageId((current) => current === garage.id ? null : garage.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-[15px] bg-[#4771A6] px-6 py-4 text-[17px] font-bold text-white shadow-[0_8px_22px_rgba(71,113,166,0.2)] transition hover:bg-[#315C91] focus-visible:outline-[#315C91]"
                >
                  <span aria-hidden="true">📅</span> Book a service
                </button>

                {bookingGarageId === garage.id && (
                  <div id={`booking-info-${garage.id}`} className="rounded-[16px] border border-[#C9D6E5] bg-[#EFF6FF] p-4 text-[#344054]">
                    <p className="text-[14px] font-bold text-[#101828]">Booking calendar coming soon</p>
                    <p className="mt-1 text-[13px] leading-5">Online appointments are not yet enabled. Contact {garage.business_name} to arrange your preferred service and time.</p>
                  </div>
                )}

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
  );
}
