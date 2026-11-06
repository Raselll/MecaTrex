"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cancelGarageBooking } from "@/app/book/actions";
import {
  BOOKING_CANCEL_LIMIT, formatMontrealTime,
  formatPriceCents, montrealDate, plusCalendarMonths, WEEKDAYS,
  type BusinessHour, type GarageBooking, type CalendarBlock,
} from "@/lib/booking";

const EMPTY_HOURS = WEEKDAYS.map((_, weekday) => ({
  weekday, provider_id: "", is_open: false, open_time: "09:00", close_time: "17:00",
}));

function dayInMontreal(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", year:"numeric", month:"2-digit", day:"2-digit" })
    .formatToParts(new Date(value)).reduce((parts, item) => ({ ...parts, [item.type]: item.value }), {} as Record<string,string>);
}

function localDate(value: string) {
  const p = dayInMontreal(value);
  return `${p.year}-${p.month}-${p.day}`;
}

export default function ProviderCalendar({
  providerId, initialCancelled, initiallySuspended,
}: {
  providerId: string;
  initialCancelled: number;
  initiallySuspended: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [hours, setHours] = useState<BusinessHour[]>(EMPTY_HOURS);
  const [bookings, setBookings] = useState<GarageBooking[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(Math.max(0, BOOKING_CANCEL_LIMIT - initialCancelled));
  const [suspended, setSuspended] = useState(initiallySuspended);
  const today = montrealDate();
  const maxDay = plusCalendarMonths(today, 6);
  const [selectedDay, setSelectedDay] = useState(today);
  const [blockKind, setBlockKind] = useState<"unavailable" | "walk_in">("unavailable");
  const [blockStart, setBlockStart] = useState("10:00");
  const [blockEnd, setBlockEnd] = useState("11:00");
  const [blockLabel, setBlockLabel] = useState("");

  const refresh = useCallback(async (withHours = false) => {
    const tasks = await Promise.all([
      supabase.from("garage_bookings").select("*")
        .eq("provider_id", providerId).order("starts_at", { ascending: false }).limit(250),
      supabase.from("garage_calendar_blocks").select("id,provider_id,starts_at,ends_at,kind,label")
        .eq("provider_id", providerId).gte("ends_at", new Date().toISOString()).order("starts_at").limit(250),
      supabase.from("service_providers").select("provider_cancellation_count,booking_suspended").eq("id", providerId).single(),
      ...(withHours ? [supabase.from("garage_business_hours").select("*").eq("provider_id",providerId).order("weekday")] : []),
    ]);
    if (tasks[0].error) setError(tasks[0].error.message);
    else setBookings((tasks[0].data ?? []) as GarageBooking[]);
    if (tasks[1].error) setError(tasks[1].error.message);
    else setBlocks((tasks[1].data ?? []) as CalendarBlock[]);
    const providerData = tasks[2].data as { provider_cancellation_count?: number; booking_suspended?: boolean } | null;
    if (providerData) {
      setRemaining(Math.max(0, 3-(providerData.provider_cancellation_count ?? 0)));
      setSuspended(Boolean(providerData.booking_suspended));
    }
    if (withHours && tasks[3]?.data) setHours(tasks[3].data as BusinessHour[]);
    setLoading(false);
  }, [providerId, supabase]);

  useEffect(() => {
    void refresh(true);
    const timer = window.setInterval(() => { setNowMs(Date.now()); void refresh(); }, 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function editHour(weekday: number, change: Partial<BusinessHour>) {
    setHours((current) => current.map((h) => h.weekday === weekday ? { ...h, ...change } : h));
  }

  async function saveHours() {
    if (hours.length !== 7) return;
    setSavingHours(true); setMessage(""); setError("");
    const { error: saveError } = await supabase.rpc("save_garage_business_hours", {
      p_provider_id: providerId,
      p_hours: hours.map((h) => ({
        weekday: h.weekday,
        is_open: h.is_open,
        open_time: h.open_time,
        close_time: h.close_time,
      })),
    });
    setSavingHours(false);
    if (saveError) setError(saveError.message);
    else { setMessage("Business hours saved. Clients can now book only during these hours."); await refresh(true); }
  }

  async function addBlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const { error: blockError } = await supabase.rpc("add_garage_calendar_block", {
      p_provider_id: providerId,
      p_day: selectedDay,
      p_start_time: blockStart,
      p_end_time: blockEnd,
      p_kind: blockKind,
      p_label: blockLabel,
    });
    setBusy(false);
    if (blockError) setError(blockError.message);
    else { setMessage(blockKind === "walk_in" ? "Walk-in reserved. This time is no longer bookable online." : "Time blocked successfully."); setBlockLabel(""); await refresh(); }
  }

  async function removeBlock(blockId: string) {
    if (!window.confirm("Release this time and make it bookable again if the garage is open?")) return;
    setBusy(true); setError(""); setMessage("");
    const { error: deleteError } = await supabase.rpc("remove_garage_calendar_block", { p_block_id: blockId });
    setBusy(false);
    if (deleteError) setError(deleteError.message);
    else { setMessage("Calendar block removed."); await refresh(); }
  }

  async function cancelBooking(booking: GarageBooking) {
    if (remaining === 0 || suspended) return;
    if (!window.confirm(
      `⚠️ Garage cancellations are limited to 3 in total. You have ${remaining} remaining.\n\nCancelling this appointment will leave ${remaining-1}. After 3 cancellations your garage is suspended from new bookings.\n\nCancel this customer's booking?`
    )) return;
    setBusy(true); setMessage(""); setError("");
    const result = await cancelGarageBooking(booking.id);
    setBusy(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message);
      if (typeof result.remaining === "number") {
        setRemaining(result.remaining);
        if (result.remaining === 0) setSuspended(true);
      }
      await refresh();
    }
  }

  const todaysBookings = bookings.filter((b) => localDate(b.starts_at) === selectedDay)
    .sort((a,b) => a.starts_at.localeCompare(b.starts_at));
  const todaysBlocks = blocks.filter((b) => localDate(b.starts_at) === selectedDay);
  const timeline = [
    ...todaysBookings.map((b) => ({ type: "booking" as const, start: b.starts_at, end: b.ends_at, booking: b })),
    ...todaysBlocks.map((b) => ({ type: "block" as const, start: b.starts_at, end: b.ends_at, block: b })),
  ].sort((a,b) => a.start.localeCompare(b.start));
  const upcoming = bookings.filter((b) => b.status === "confirmed" && new Date(b.ends_at).getTime() > nowMs);

  return (
    <section id="garage-calendar" className="scroll-mt-24 space-y-6">
      <div className="rounded-[25px] border border-[#BAC7D7] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[12px] font-bold uppercase tracking-wider text-[#4771A6]">Included with MECATREX · no calendar add-on</p>
            <h2 className="mt-1 text-[27px] font-extrabold tracking-[-0.04em]">📅 Calendar & availability</h2>
            <p className="mt-1 text-[14px] text-[#667085]">Your bookings, walk-ins and closed slots share one live schedule (Montreal time).</p></div>
          <button type="button" onClick={() => void refresh()} className="rounded-[12px] border border-[#BAC7D7] px-4 py-3 text-[13px] font-bold text-[#315C91] hover:bg-[#EDF3FA]">↻ Refresh calendar</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[15px] bg-[#EDF3FA] p-5"><p className="text-[12px] font-bold text-[#667085]">Upcoming bookings</p><p className="mt-1 text-[28px] font-extrabold">{upcoming.length}</p></div>
          <div className="rounded-[15px] bg-[#F2F4F7] p-5"><p className="text-[12px] font-bold text-[#667085]">Cancellations remaining</p><p className={`mt-1 text-[28px] font-extrabold ${remaining === 0 ? "text-[#B42318]" : "text-[#101828]"}`}>{remaining} / 3</p></div>
          <div className={`rounded-[15px] p-5 ${suspended ? "bg-[#FEF3F2]" : "bg-[#ECFDF3]"}`}><p className="text-[12px] font-bold text-[#667085]">Booking status</p><p className={`mt-1 text-[19px] font-extrabold ${suspended ? "text-[#B42318]" : "text-[#027A48]"}`}>{suspended ? "Suspended · contact admin" : "Ready when hours are set"}</p></div>
        </div>
        {suspended && <p role="alert" className="mt-4 rounded-[13px] border border-[#FDA29B] bg-[#FEF3F2] p-4 text-[13px] font-bold text-[#B42318]">Your garage reached three provider cancellations. It cannot accept new MECATREX bookings or be published until an administrator reviews the account. Existing appointments must still be honored.</p>}
        {error && <p role="alert" className="mt-4 rounded-[13px] bg-[#FEF3F2] p-4 text-[13px] font-semibold text-[#B42318]">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-[13px] bg-[#ECFDF3] p-4 text-[13px] font-semibold text-[#027A48]">{message}</p>}
      </div>

      <div className="rounded-[25px] border border-[#BAC7D7] bg-white p-6 sm:p-8">
        <h3 className="text-[22px] font-extrabold text-[#101828]">🕘 Regular business hours</h3>
        <p className="mt-1 text-[13px] leading-5 text-[#667085]">Nothing is assumed open until you enable the days your garage operates. Overnight hours are supported (for example 22:00 to 03:00).</p>
        <div className="mt-5 space-y-3">
          {WEEKDAYS.map((day, weekday) => {
            const hour = hours.find((h) => h.weekday === weekday) ?? EMPTY_HOURS[weekday];
            return <div key={day} className="grid items-center gap-3 rounded-[14px] border border-[#D0D5DD] bg-[#F8FAFC] p-4 sm:grid-cols-[160px_1fr_1fr]">
              <label className="flex cursor-pointer items-center gap-3 text-[14px] font-extrabold text-[#101828]">
                <input type="checkbox" checked={hour.is_open} onChange={(e) => editHour(weekday, { is_open: e.target.checked })}
                  className="h-5 w-5 accent-[#4771A6]" />{day}
              </label>
              <label className="flex items-center gap-2 text-[12px] font-bold text-[#475467]">Open
                <input type="time" step={1800} value={hour.open_time.slice(0,5)} disabled={!hour.is_open}
                  onChange={(e) => editHour(weekday, { open_time: e.target.value })}
                  className="min-w-0 flex-1 rounded-[11px] border border-[#98A2B3] bg-white px-3 py-2 text-[14px] text-[#101828] disabled:opacity-50" />
              </label>
              <label className="flex items-center gap-2 text-[12px] font-bold text-[#475467]">Close
                <input type="time" step={1800} value={hour.close_time.slice(0,5)} disabled={!hour.is_open}
                  onChange={(e) => editHour(weekday, { close_time: e.target.value })}
                  className="min-w-0 flex-1 rounded-[11px] border border-[#98A2B3] bg-white px-3 py-2 text-[14px] text-[#101828] disabled:opacity-50" />
              </label>
            </div>;
          })}
        </div>
        <button type="button" disabled={savingHours || hours.length !== 7} onClick={() => void saveHours()}
          className="mt-5 rounded-[13px] bg-[#4771A6] px-6 py-3.5 text-[14px] font-bold text-white hover:bg-[#315C91] disabled:opacity-50">{savingHours ? "Saving…" : "Save business hours"}</button>
        <p className="mt-2 text-[12px] text-[#667085]">Changing your hours will be blocked if it would conflict with an already confirmed customer appointment.</p>
      </div>

      <div className="rounded-[25px] border border-[#BAC7D7] bg-white p-6 sm:p-8">
        <h3 className="text-[22px] font-extrabold">🗓️ Daily calendar</h3>
        <p className="mt-1 text-[13px] text-[#667085]">Book time for a walk-in, broken equipment, staff absence or any other reason.</p>
        <label className="mt-5 block max-w-[320px]">
          <span className="mb-2 block text-[12px] font-bold uppercase text-[#667085]">View day (Montreal time)</span>
          <input type="date" value={selectedDay} min={today} max={maxDay} onChange={(event) => setSelectedDay(event.target.value)}
            className="w-full rounded-[12px] border border-[#98A2B3] px-4 py-3 text-[15px] font-bold" />
        </label>
        {loading ? <p className="mt-6 text-[14px] text-[#667085]">Loading calendar…</p> : timeline.length === 0 ? (
          <p className="mt-6 rounded-[16px] border border-dashed border-[#BAC7D7] bg-[#F8FAFC] p-7 text-center text-[14px] text-[#667085]">No appointments or blocks on this date. Available slots depend on your business hours.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {timeline.map((entry) => entry.type === "booking" ? (
              <div key={`booking-${entry.booking.id}`} className={`rounded-[16px] border-l-[6px] p-5 ${entry.booking.status === "confirmed" ? "border-l-[#4771A6] bg-[#EDF3FA]" : "border-l-[#D0D5DD] bg-[#F2F4F7]"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-wide text-[#315C91]">{entry.booking.status === "confirmed" ? "Confirmed booking" : "Cancelled booking"}</p>
                    <h4 className="mt-1 text-[17px] font-extrabold">{formatMontrealTime(entry.booking.starts_at)} – {formatMontrealTime(entry.booking.ends_at)} · {entry.booking.duration_minutes} min</h4>
                    <p className="mt-2 text-[14px] font-bold">{entry.booking.service_name} · {formatPriceCents(entry.booking.price_cents)}</p>
                    <p className="mt-1 text-[13px]">Customer: {entry.booking.client_name}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-[12px]">
                      <a href={`tel:${entry.booking.client_phone.replace(/[^\d+]/g, "")}`} className="font-semibold text-[#315C91] underline">📞 {entry.booking.client_phone}</a>
                      <a href={`mailto:${entry.booking.client_email}`} className="font-semibold text-[#315C91] underline">✉️ {entry.booking.client_email}</a>
                    </div>
                    {entry.booking.note && <p className="mt-2 text-[12px] text-[#667085]">Note: {entry.booking.note}</p>}
                  </div>
                  {entry.booking.status === "confirmed" && new Date(entry.booking.starts_at).getTime() > nowMs && (
                    <button type="button" disabled={busy || remaining === 0 || suspended}
                      onClick={() => void cancelBooking(entry.booking)} className="rounded-[11px] border border-[#FDA29B] bg-white px-4 py-3 text-[12px] font-bold text-[#B42318] hover:bg-[#FEF3F2] disabled:cursor-not-allowed disabled:opacity-40">
                      Cancel · {remaining} left
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div key={`block-${entry.block.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border-l-[6px] border-l-[#D97706] bg-[#FFFAEB] p-5">
                <div><p className="text-[12px] font-extrabold uppercase text-[#92400E]">{entry.block.kind === "walk_in" ? "🚙 Walk-in" : "⛔ Unavailable"}</p>
                  <p className="mt-1 text-[16px] font-extrabold text-[#101828]">{formatMontrealTime(entry.start)} – {formatMontrealTime(entry.end)}</p>
                  {entry.block.label && <p className="mt-1 text-[12px] text-[#92400E]">{entry.block.label}</p>}
                </div>
                <button type="button" disabled={busy} onClick={() => void removeBlock(entry.block.id)}
                  className="rounded-[11px] border border-[#FEC84B] bg-white px-4 py-2.5 text-[12px] font-bold text-[#92400E] disabled:opacity-50">Release slot</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={addBlock} className="rounded-[25px] border border-[#BAC7D7] bg-white p-6 sm:p-8">
        <h3 className="text-[22px] font-extrabold">+ Block a time / reserve a walk-in</h3>
        <p className="mt-1 text-[13px] text-[#667085]">This blocks online availability without cancelling an existing booking.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-2 block text-[13px] font-bold">Reason</span>
            <select value={blockKind} onChange={(e) => setBlockKind(e.target.value as "unavailable" | "walk_in")}
              className="w-full rounded-[12px] border border-[#98A2B3] bg-white px-4 py-3 text-[14px]">
              <option value="unavailable">⛔ Unavailable / equipment / holiday</option>
              <option value="walk_in">🚙 Walk-in appointment</option>
            </select>
          </label>
          <label className="block"><span className="mb-2 block text-[13px] font-bold">Label (optional, private)</span>
            <input value={blockLabel} maxLength={100} onChange={(e) => setBlockLabel(e.target.value)}
              placeholder="e.g. Lift maintenance" className="w-full rounded-[12px] border border-[#98A2B3] px-4 py-3 text-[14px]" />
          </label>
          <label className="block"><span className="mb-2 block text-[13px] font-bold">From</span>
            <input required type="time" step={900} value={blockStart} onChange={(e) => setBlockStart(e.target.value)}
              className="w-full rounded-[12px] border border-[#98A2B3] px-4 py-3 text-[14px]" />
          </label>
          <label className="block"><span className="mb-2 block text-[13px] font-bold">Until</span>
            <input required type="time" step={900} value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)}
              className="w-full rounded-[12px] border border-[#98A2B3] px-4 py-3 text-[14px]" />
          </label>
        </div>
        <button disabled={busy || !selectedDay || selectedDay < today || selectedDay > maxDay} type="submit"
          className="mt-5 rounded-[13px] bg-[#101828] px-6 py-3.5 text-[14px] font-bold text-white hover:bg-[#315C91] disabled:opacity-50">{busy ? "Saving…" : "Block selected time"}</button>
      </form>
    </section>
  );
}
