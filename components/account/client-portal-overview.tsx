"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMontrealDateTime, formatPriceCents } from "@/lib/booking";

type BookingPreview = {
  id: string;
  garage_name: string;
  garage_address: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  price_cents: number;
  status: "confirmed" | "client_cancelled" | "provider_cancelled";
  towing_status?: "pending" | "accepted" | "cancelled" | null;
};

type BookingSummary = {
  upcoming: number;
  completed: number;
  cancelled: number;
  next: BookingPreview | null;
};

type Contact = {
  first_name: string;
  last_name: string;
  primary_phone: string;
  secondary_phone: string;
};

type Props = {
  userId: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  secondaryPhone: string | null;
  mode?: "overview" | "settings";
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.slice(0, 3) + "-" + digits.slice(3);
  return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
}

const phonePattern = /^\d{3}-\d{3}-\d{4}$/;

export default function ClientPortalOverview({
  userId,
  firstName,
  lastName,
  primaryPhone,
  secondaryPhone,
  mode = "overview",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [summary, setSummary] = useState<BookingSummary | null>(null);
  const [bookingError, setBookingError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [contact, setContact] = useState<Contact>({
    first_name: firstName,
    last_name: lastName,
    primary_phone: formatPhone(primaryPhone),
    secondary_phone: formatPhone(secondaryPhone ?? ""),
  });

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      const { data, error } = await supabase
        .from("garage_bookings")
        .select("id,garage_name,garage_address,service_name,starts_at,ends_at,price_cents,status")
        .eq("client_id", userId)
        .order("starts_at", { ascending: false })
        .limit(250);

      if (!active) return;

      if (error) {
        setBookingError("Your appointment summary could not be loaded.");
        return;
      }

      const bookings = (data ?? []) as BookingPreview[];
      const now = Date.now();
      const upcoming = bookings
        .filter((booking) => booking.status === "confirmed" && new Date(booking.ends_at).getTime() > now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

      const next = upcoming[0] ?? null;
      let nextWithTowing = next;
      if (next) {
        const { data: towing } = await supabase.from("towing_requests")
          .select("status").eq("booking_id", next.id).maybeSingle();
        nextWithTowing = { ...next, towing_status: (towing?.status ?? null) as BookingPreview["towing_status"] };
      }
      if (!active) return;
      setSummary({
        upcoming: upcoming.length,
        completed: bookings.filter((booking) => booking.status === "confirmed" && new Date(booking.ends_at).getTime() <= now).length,
        cancelled: bookings.filter((booking) => booking.status !== "confirmed").length,
        next: nextWithTowing,
      });
      setBookingError("");
    }

    void loadOverview();
    const interval = window.setInterval(() => void loadOverview(), 30000);
    window.addEventListener("focus", loadOverview);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadOverview);
    };
  }, [supabase, userId]);

  function updateField(field: keyof Contact, value: string) {
    setContact((current) => ({ ...current, [field]: field.includes("phone") ? formatPhone(value) : value }));
  }

  async function saveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    setSaveNotice("");

    const clean: Contact = {
      first_name: contact.first_name.trim(),
      last_name: contact.last_name.trim(),
      primary_phone: contact.primary_phone.trim(),
      secondary_phone: contact.secondary_phone.trim(),
    };

    if (!clean.first_name || !clean.last_name) {
      setSaveError("Please enter your first and last name.");
      return;
    }
    if (!phonePattern.test(clean.primary_phone)) {
      setSaveError("Use 514-555-1234 for the primary phone number.");
      return;
    }
    if (clean.secondary_phone && !phonePattern.test(clean.secondary_phone)) {
      setSaveError("Use 514-555-1234 for the secondary phone number.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({
        first_name: clean.first_name,
        last_name: clean.last_name,
        primary_phone: clean.primary_phone,
        secondary_phone: clean.secondary_phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    setSaving(false);
    if (error || !data) {
      setSaveError(error?.message ?? "Your changes could not be saved.");
      return;
    }

    setContact(clean);
    setEditing(false);
    setSaveNotice("Your contact details were saved.");
    router.refresh();
  }

  const statCards = [
    { label: "Upcoming", value: summary?.upcoming, emoji: "📅" },
    { label: "Completed", value: summary?.completed, emoji: "✅" },
  ];

  return (
    <section id={mode === "overview" ? "client-dashboard" : "client-settings-profile"} className="space-y-5" aria-label={mode === "overview" ? "Client dashboard" : "Contact settings"}>
      <div hidden={mode !== "overview"} className="rounded-[22px] border border-[#C8D8EA] bg-gradient-to-br from-[#EDF3FA] via-white to-[#F8FAFC] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">Your activity</p>
            <h2 className="mt-2 text-[25px] font-extrabold tracking-tight text-[#101828]">Ready for your next visit?</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#667085]">Book a garage, check your next appointment or view previous visits.</p>
          </div>
          <Link href="/#garage-results" className="inline-flex items-center rounded-[13px] bg-[#4771A6] px-5 py-3 text-[13px] font-extrabold text-white hover:bg-[#315C91]">
            + Find a garage
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
          {statCards.map((stat) => (
            <div key={stat.label} className="rounded-[17px] border border-[#DFE7F1] bg-white p-3 sm:p-4">
              <p className="text-[18px]" aria-hidden="true">{stat.emoji}</p>
              <p className="mt-2 text-[23px] font-extrabold tabular-nums text-[#101828]">{stat.value ?? "—"}</p>
              <p className="text-[11px] font-bold text-[#667085]">{stat.label}</p>
            </div>
          ))}
        </div>

        {bookingError && <p role="alert" className="mt-4 text-[12px] font-semibold text-[#B42318]">{bookingError}</p>}

        <div className="mt-4 rounded-[17px] border border-[#DFE7F1] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-extrabold text-[#101828]">🚗 Next appointment</h3>
            <span className="text-[11px] font-bold text-[#315C91]">See My appointments tab</span>
          </div>
          {!summary ? (
            <p className="mt-3 text-[13px] text-[#667085]">Loading your appointments…</p>
          ) : summary.next ? (
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[17px] font-extrabold text-[#101828]">{summary.next.garage_name}</p>
                <p className="mt-1 text-[13px] font-semibold text-[#315C91]">{summary.next.service_name}</p>
                {summary.next.towing_status === "pending" && (
                  <p className="mt-2 rounded-lg bg-[#FFFAE7] px-3 py-2 text-[12px] font-extrabold text-[#795700]">
                    🚛 Garage reserved · awaiting towing acceptance
                  </p>
                )}
                {summary.next.towing_status === "accepted" && (
                  <p className="mt-2 rounded-lg bg-[#ECFDF3] px-3 py-2 text-[12px] font-extrabold text-[#05603A]">
                    ✓ Garage and towing confirmed
                  </p>
                )}
                <p className="mt-2 text-[12px] text-[#475467]">📅 {formatMontrealDateTime(summary.next.starts_at)}</p>
                <p className="mt-1 text-[12px] text-[#667085]">📍 {summary.next.garage_address}</p>
              </div>
              <span className="text-[15px] font-extrabold text-[#101828]">{formatPriceCents(summary.next.price_cents)}</span>
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-[#667085]">No upcoming appointments. Find a garage whenever you need one.</p>
          )}
        </div>

      </div>

      <div id={mode === "settings" ? "client-profile" : undefined} hidden={mode !== "settings"} className="scroll-mt-24 rounded-[22px] border border-[#D5DFEA] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">Your information</p>
            <h3 className="mt-1 text-[19px] font-extrabold text-[#101828]">Manage contact details</h3>
            <p className="mt-1 text-[12px] leading-5 text-[#667085]">Keep your contact information up to date for future appointments.</p>
          </div>
          {!editing && (
            <button type="button" onClick={() => { setEditing(true); setSaveNotice(""); }} className="rounded-[11px] border border-[#CAD8E8] px-4 py-2.5 text-[12px] font-bold text-[#315C91] hover:bg-[#EDF3FA]">Edit details</button>
          )}
        </div>

        {!editing && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[13px] bg-[#F8FAFC] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">Name</p>
              <p className="mt-1 text-[13px] font-bold text-[#101828]">{contact.first_name} {contact.last_name}</p>
            </div>
            <div className="rounded-[13px] bg-[#F8FAFC] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">Primary phone</p>
              <p className="mt-1 text-[13px] font-bold text-[#101828]">{contact.primary_phone}</p>
            </div>
            {contact.secondary_phone && (
              <div className="rounded-[13px] bg-[#F8FAFC] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">Secondary phone</p>
                <p className="mt-1 text-[13px] font-bold text-[#101828]">{contact.secondary_phone}</p>
              </div>
            )}
          </div>
        )}

        {saveNotice && <p role="status" className="mt-4 rounded-xl bg-[#ECFDF3] p-3 text-[12px] font-semibold text-[#027A48]">{saveNotice}</p>}
        {saveError && <p role="alert" className="mt-4 rounded-xl bg-[#FEF3F2] p-3 text-[12px] font-semibold text-[#B42318]">{saveError}</p>}

        {editing && (
          <form onSubmit={(event) => void saveContact(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
            {([
              ["first_name", "First name"],
              ["last_name", "Last name"],
              ["primary_phone", "Primary phone"],
              ["secondary_phone", "Secondary phone (optional)"],
            ] as const).map(([field, label]) => (
              <label key={field} className="block">
                <span className="mb-1.5 block text-[12px] font-bold text-[#344054]">{label}</span>
                <input
                  type={field.includes("phone") ? "tel" : "text"}
                  value={contact[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                  maxLength={field.includes("phone") ? 12 : 100}
                  required={field !== "secondary_phone"}
                  placeholder={field.includes("phone") ? "514-555-1234" : undefined}
                  className="w-full rounded-[11px] border border-[#BAC7D7] bg-white px-3 py-3 text-[13px] text-[#101828] outline-none focus:border-[#4771A6]"
                />
                {field.includes("phone") && <span className="mt-1 block text-[11px] text-[#667085]">Format: XXX-XXX-XXXX · automatically formatted as you type</span>}
              </label>
            ))}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" disabled={saving} className="rounded-[11px] bg-[#4771A6] px-5 py-3 text-[12px] font-extrabold text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>
              <button type="button" disabled={saving} onClick={() => { setEditing(false); setSaveError(""); setContact({ first_name: firstName, last_name: lastName, primary_phone: formatPhone(primaryPhone), secondary_phone: formatPhone(secondaryPhone ?? "") }); }} className="rounded-[11px] border border-[#CAD8E8] px-5 py-3 text-[12px] font-bold text-[#344054]">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
