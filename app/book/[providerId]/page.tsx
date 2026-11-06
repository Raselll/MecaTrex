import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookingForm from "@/components/booking/booking-form";
import { formatHour, WEEKDAYS, type BusinessHour } from "@/lib/booking";
import { normalizeBusinessWebsite } from "@/lib/service-listing";

export const dynamic = "force-dynamic";

type PublicService = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  pricing_type: string;
  duration_minutes: number;
  is_active: boolean;
};

export default async function GarageBookingPage({
  params, searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const [{ providerId }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: { user } }, { data: garage }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("service_providers")
      .select("id,business_name,business_description,address_line1,city,province,postal_code,public_phone,public_email,website,image_path,status,is_listing_active,provider_type,booking_suspended")
      .eq("id", providerId)
      .eq("provider_type", "garage")
      .eq("status", "approved")
      .eq("is_listing_active", true)
      .maybeSingle(),
  ]);
  if (!garage || garage.booking_suspended) notFound();

  const [{ data: rawServices }, { data: rawHours }, { data: rawReviews }, { data: profile }] = await Promise.all([
    supabase.from("provider_services")
      .select("id,name,description,price_cents,pricing_type,duration_minutes,is_active")
      .eq("provider_id", providerId).eq("is_active", true).eq("pricing_type", "fixed")
      .order("name"),
    supabase.from("garage_business_hours")
      .select("provider_id,weekday,is_open,open_time,close_time")
      .eq("provider_id", providerId).order("weekday"),
    supabase.from("garage_reviews")
      .select("id,stars,comment,created_at")
      .eq("provider_id", providerId).order("created_at", { ascending: false }).limit(5),
    user ? supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const services = ((rawServices ?? []) as PublicService[])
    .filter((s) => s.price_cents !== null && s.duration_minutes !== null && s.duration_minutes > 0)
    .map((s) => ({ id: s.id, name: s.name, description: s.description, price_cents: s.price_cents, duration_minutes: s.duration_minutes }));
  const hours = (rawHours ?? []) as BusinessHour[];
  const reviews = rawReviews ?? [];
  const rating = reviews.length > 0 ? (reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length).toFixed(1) : null;
  const website = normalizeBusinessWebsite(garage.website ?? "");
  const image = garage.image_path ? supabase.storage.from("garage-images").getPublicUrl(garage.image_path).data.publicUrl : "";

  return (
    <main className="min-h-screen bg-[#F5F7FA] pb-20 text-[#101828]">
      <header className="border-b border-[#E4E7EC] bg-white">
        <div className="mx-auto flex max-w-[1170px] items-center justify-between gap-4 px-5 py-5">
          <Link href="/#garage-results">
            <Image src="/mecatrex-logo-web.png" alt="MECATREX" width={230} height={65} priority className="h-[49px] w-auto" />
          </Link>
          <Link href="/#garage-results" className="rounded-[13px] border border-[#BAC7D7] px-4 py-3 text-[13px] font-bold text-[#344054] hover:bg-[#EDF3FA]">← All garages</Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1170px] px-5">
        <div className="mt-8 overflow-hidden rounded-[27px] border border-[#DCE4ED] bg-white sm:grid sm:grid-cols-[0.36fr_0.64fr]">
          <div className="h-[220px] bg-gradient-to-br from-[#14263A] to-[#4771A6] sm:h-full sm:min-h-[250px]">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={garage.business_name} className="h-full w-full object-cover" />
            ) : <div className="flex h-full items-center justify-center text-[84px]">🔧</div>}
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#4771A6]">✓ Approved MECATREX garage</p>
            <h1 className="mt-2 text-[34px] font-extrabold tracking-[-0.04em]">{garage.business_name}</h1>
            {garage.business_description && <p className="mt-2 text-[14px] leading-6 text-[#667085]">{garage.business_description}</p>}
            <div className="mt-5 space-y-2 text-[14px] text-[#475467]">
              <p>📍 {garage.address_line1}, {garage.city}, {garage.province} {garage.postal_code}</p>
              {garage.public_phone && <p>📞 <a className="font-bold text-[#315C91] underline" href={`tel:${garage.public_phone.replace(/[^\d+]/g, "")}`}>{garage.public_phone}</a></p>}
              {garage.public_email && <p>✉️ <a className="break-all font-bold text-[#315C91] underline" href={`mailto:${garage.public_email}`}>{garage.public_email}</a></p>}
              {website && <p>🌐 <a href={website} target="_blank" rel="noopener noreferrer" className="font-bold text-[#315C91] underline">Visit garage website ↗</a></p>}
              {rating && <p className="font-semibold">⭐ {rating}/5 · {reviews.length} recent review{reviews.length !== 1 ? "s" : ""}</p>}
            </div>
          </div>
        </div>

        <div className="mt-7 grid items-start gap-7 lg:grid-cols-[1.42fr_0.76fr]">
          <div>
            <div className="mb-5">
              <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#4771A6]">Garage booking</p>
              <h2 className="mt-2 text-[32px] font-extrabold tracking-[-0.04em]">Book your service in a minute.</h2>
              <p className="mt-1 text-[15px] text-[#667085]">See real availability, choose your time, and confirm instantly.</p>
            </div>
            {services.length > 0 ? (
              <BookingForm providerId={providerId} services={services} hours={hours}
                initialService={query.service} canConfirm={profile?.account_type === "client"} />
            ) : (
              <div className="rounded-[23px] border border-[#FEC84B] bg-white p-6 text-[#92400E]">This garage has no active fixed-price services yet.</div>
            )}
          </div>

          <aside className="space-y-5">
            <section className="rounded-[23px] border border-[#BAC7D7] bg-white p-6">
              <h3 className="text-[20px] font-extrabold">🕒 Business hours</h3>
              <p className="mt-1 text-[12px] text-[#667085]">Montreal local time · changes appear automatically in availability</p>
              <div className="mt-4 space-y-2.5">
                {WEEKDAYS.map((day, i) => {
                  const info = hours.find((h) => h.weekday === i);
                  return <div key={day} className="flex justify-between gap-4 border-b border-[#EEF2F6] pb-2 text-[13px]">
                    <span className="font-semibold text-[#344054]">{day}</span>
                    <span className={info?.is_open ? "font-bold text-[#101828]" : "text-[#98A2B3]"}>
                      {info?.is_open ? `${formatHour(info.open_time)} – ${formatHour(info.close_time)}` : "Closed"}
                    </span>
                  </div>;
                })}
              </div>
              <p className="mt-3 text-[12px] text-[#667085]">Specific dates can also be blocked by the garage. Only available appointments appear in the booking form.</p>
            </section>

            <section className="rounded-[23px] border border-[#BAC7D7] bg-white p-6">
              <h3 className="text-[20px] font-extrabold">⭐ Garage reviews</h3>
              {reviews.length === 0 ? (
                <p className="mt-3 text-[13px] text-[#667085]">No reviews yet. Only customers with a completed appointment can leave one.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-[13px] bg-[#F8FAFC] p-4">
                      <p aria-label={`${review.stars} out of 5 stars`} className="text-[15px] text-[#D97706]">{"★".repeat(review.stars)}{"☆".repeat(5 - review.stars)}</p>
                      {review.comment && <p className="mt-1 text-[13px] leading-5 text-[#475467]">{review.comment}</p>}
                      <p className="mt-2 text-[11px] text-[#98A2B3]">{new Date(review.created_at).toLocaleDateString("en-CA")}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
