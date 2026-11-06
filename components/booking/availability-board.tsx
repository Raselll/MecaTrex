"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  formatMontrealTime, formatPriceCents, montrealDate, plusCalendarMonths,
  type BusinessHour, type CalendarBlock, type GarageBooking,
} from "@/lib/booking";

type Props = {
  providerId: string;
  bookings: GarageBooking[];
  blocks: CalendarBlock[];
  hours: BusinessHour[];
  loading: boolean;
  busy: boolean;
  remaining: number;
  suspended: boolean;
  nowMs: number;
  onRefresh: () => Promise<void>;
  onRemoveBlock: (id: string) => Promise<void>;
  onCancelBooking: (booking: GarageBooking) => Promise<void>;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function utcDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = utcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return dayString(date);
}

function weekStart(iso: string) {
  return addDays(iso, -utcDate(iso).getUTCDay());
}

function dayInMontreal(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function prettyDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short", day: "numeric" }).format(utcDate(iso));
}

function longDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC", weekday: "long", month: "long", day: "numeric",
  }).format(utcDate(iso));
}

export default function AvailabilityBoard({
  providerId, bookings, blocks, hours, loading, busy, remaining, suspended, nowMs,
  onRefresh, onRemoveBlock, onCancelBooking,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const today = montrealDate();
  const lastDay = plusCalendarMonths(today, 6);
  const [visibleWeek, setVisibleWeek] = useState(() => weekStart(today));
  const [selectedDays, setSelectedDays] = useState<string[]>([today]);
  const [mode, setMode] = useState<"all-day" | "hours">("all-day");
  const [fromTime, setFromTime] = useState("09:00");
  const [untilTime, setUntilTime] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const days = Array.from({ length: 7 }, (_, i) => addDays(visibleWeek, i));
  const lastWeek = weekStart(lastDay);
  const firstWeek = weekStart(today);
  const currentBookings = bookings.filter((booking) => booking.status === "confirmed");
  const selected = selectedDays.filter((day) => DATE_ONLY.test(day) && day >= today && day <= lastDay).sort();
  const selectedSet = new Set(selected);
  const dayHasBooking = (day: string) => currentBookings.some((booking) => dayInMontreal(booking.starts_at) === day);
  const dayBlocks = (day: string) => blocks.filter((block) => dayInMontreal(block.starts_at) === day);
  const dayBookings = (day: string) => bookings.filter((booking) => dayInMontreal(booking.starts_at) === day);
  const hasToday = selected.includes(today);
  const conflictingAllDay = mode === "all-day" && selected.some(dayHasBooking);

  function choose(day: string) {
    if (day < today || day > lastDay) return;
    setNotice("");
    setError("");
    setSelectedDays((current) => {
      if (current.includes(day)) return current.length > 1 ? current.filter((item) => item !== day) : current;
      return [...current, day].sort();
    });
  }

  function navigate(direction: -1 | 1) {
    const target = addDays(visibleWeek, direction * 7);
    if (target < firstWeek || target > lastWeek) return;
    setVisibleWeek(target);
    setSelectedDays([]);
    setNotice("");
    setError("");
  }

  async function blockSelected() {
    setNotice("");
    setError("");
    if (!selected.length) { setError("Select at least one date in the calendar."); return; }
    if (mode === "all-day" && hasToday) {
      setError("For today, use Custom hours to choose a future start time.");
      return;
    }
    if (conflictingAllDay) {
      setError("One of these days already has a confirmed appointment. Select a different day, or choose Custom hours around it.");
      return;
    }

    const start = mode === "all-day" ? "00:00" : fromTime;
    const end = mode === "all-day" ? "23:59:59" : untilTime;
    if (start >= end) { setError("The end time must be later than the start time."); return; }
    if (mode === "hours" && selected.includes(today)) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).format(new Date(nowMs));
      if (fromTime <= parts) {
        setError("Today's start time must be in the future.");
        return;
      }
    }

    setSubmitting(true);
    const succeeded: string[] = [];
    const failed: string[] = [];
    try {
      for (const day of selected) {
        const { error: insertError } = await supabase.rpc("add_garage_calendar_block", {
          p_provider_id: providerId,
          p_day: day,
          p_start_time: start,
          p_end_time: end,
          p_kind: "unavailable",
          p_label: mode === "all-day" ? "All day unavailable" : "Unavailable",
        });
        if (insertError) failed.push(`${prettyDay(day)}: ${insertError.message}`);
        else succeeded.push(day);
      }
      if (succeeded.length) {
        await onRefresh();
        setNotice(`${succeeded.length} ${succeeded.length === 1 ? "day" : "days"} updated. Clients cannot book the blocked time.`);
      }
      if (failed.length) setError(`Some dates could not be blocked: ${failed.join(" · ")}`);
      setSelectedDays(failed.length ? selected.filter((day) => !succeeded.includes(day)) : []);
    } catch {
      setError("Could not update the calendar. Refresh and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label="Garage availability calendar" className="overflow-hidden rounded-[26px] border border-[#BAC7D7] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E7EC] px-5 py-5 sm:px-7">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#4771A6]">Availability</p>
          <h3 className="mt-1 text-[24px] font-extrabold text-[#101828]">Block time in a few clicks</h3>
          <p className="mt-1 text-[13px] text-[#667085]">Select one or more dates, then mark them unavailable. No complex calendar setup.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setVisibleWeek(firstWeek); setSelectedDays([today]); }} className="rounded-[11px] border border-[#D0D5DD] bg-white px-4 py-2.5 text-[12px] font-bold text-[#344054] hover:bg-[#F2F4F7]">Today</button>
          <button aria-label="Previous week" title="Previous week" disabled={visibleWeek <= firstWeek} type="button" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#D0D5DD] text-xl text-[#101828] hover:bg-[#F2F4F7] disabled:opacity-30">‹</button>
          <button aria-label="Next week" title="Next week" disabled={visibleWeek >= lastWeek} type="button" onClick={() => navigate(1)} className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#D0D5DD] text-xl text-[#101828] hover:bg-[#F2F4F7] disabled:opacity-30">›</button>
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-[18px] font-extrabold text-[#101828]">
              {prettyDay(days[0])} – {prettyDay(days[6])}, {utcDate(days[6]).getUTCFullYear()}
            </h4>
            <span className="rounded-full bg-[#EDF3FA] px-3 py-1.5 text-[12px] font-bold text-[#315C91]">{selected.length} selected</span>
          </div>
          <p className="mb-3 text-[12px] text-[#667085]">Tap a date to select it. Tap another to select multiple days.</p>
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[630px] grid-cols-7 gap-2" role="group" aria-label="Select days to block">
              {days.map((day, i) => {
                const outOfRange = day < today || day > lastDay;
                const selectedDay = selectedSet.has(day);
                const isToday = day === today;
                const hour = hours.find((h) => h.weekday === utcDate(day).getUTCDay());
                const closed = hour ? !hour.is_open : true;
                const dayConfirmed = currentBookings.filter((booking) => dayInMontreal(booking.starts_at) === day);
                const dailyBlocks = dayBlocks(day);
                const unavailable = dailyBlocks.some((b) => b.kind === "unavailable");
                const walkIn = dailyBlocks.some((b) => b.kind === "walk_in");
                return (
                  <button
                    key={day} type="button" disabled={outOfRange}
                    aria-pressed={selectedDay} aria-label={`${longDay(day)}${isToday ? ", today" : ""}, ${dayConfirmed.length} bookings, ${dailyBlocks.length} blocks`}
                    onClick={() => choose(day)}
                    className={`relative flex min-h-[170px] flex-col items-start rounded-[15px] border-2 p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4771A6]
                      ${selectedDay ? "border-[#4771A6] bg-[#EDF3FA] shadow-[0_6px_17px_rgba(71,113,166,0.13)]" : "border-[#E4E7EC] bg-white hover:border-[#94B4DC] hover:bg-[#F8FAFC]"}
                      ${outOfRange ? "cursor-not-allowed opacity-30" : "cursor-pointer"}`}
                  >
                    <span className={`text-[11px] font-bold uppercase ${selectedDay ? "text-[#315C91]" : "text-[#98A2B3]"}`}>{DAY_LABELS[i]}</span>
                    <span className={`mt-1 text-[23px] font-extrabold ${selectedDay ? "text-[#315C91]" : "text-[#101828]"}`}>{utcDate(day).getUTCDate()}</span>
                    {isToday && <span className="mt-1 text-[10px] font-bold text-[#4771A6]">Today</span>}
                    <div className="mt-auto w-full space-y-1.5 pt-4">
                      {closed ? <span className="block rounded-md bg-[#F2F4F7] px-1.5 py-1 text-center text-[10px] font-bold text-[#667085]">Closed</span> :
                        <span className="block rounded-md bg-[#ECFDF3] px-1.5 py-1 text-center text-[10px] font-bold text-[#027A48]">Open hours</span>}
                      {dayConfirmed.length > 0 && <span className="block rounded-md bg-[#E6EFFA] px-1.5 py-1 text-center text-[10px] font-bold text-[#315C91]">{dayConfirmed.length} booked</span>}
                      {(unavailable || walkIn) && <span className="block rounded-md bg-[#FFFAEB] px-1.5 py-1 text-center text-[10px] font-bold text-[#92400E]">{dailyBlocks.length} blocked</span>}
                    </div>
                    {selectedDay && <span aria-hidden="true" className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#4771A6] text-[11px] font-bold text-white">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-semibold text-[#667085]">
            <span> <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#12B76A]" /> Open hours</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#4771A6]" /> Booked</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /> Unavailable</span>
          </div>
          {loading && <p className="mt-4 text-[13px] text-[#667085]">Refreshing your calendar…</p>}
          <p className="mt-3 text-[12px] text-[#98A2B3]">Shown in Montreal time. Existing confirmed appointments cannot be overwritten by a new block.</p>
        </div>

        <aside className="border-t border-[#E4E7EC] bg-[#F8FAFC] p-5 lg:border-l lg:border-t-0 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#4771A6]">Unavailability</p>
          <h4 className="mt-2 text-[20px] font-extrabold text-[#101828]">{selected.length ? `${selected.length} ${selected.length === 1 ? "day" : "days"} selected` : "Select a date"}</h4>
          {selected.length === 1 && <p className="mt-1 text-[13px] text-[#667085]">{longDay(selected[0])}</p>}
          {selected.length > 1 && <p className="mt-1 text-[12px] text-[#667085]">Selected: {selected.map(prettyDay).join(", ")}</p>}

          <div className="mt-5 grid grid-cols-2 rounded-[12px] bg-[#E9EEF5] p-1" role="group" aria-label="Block type">
            <button type="button" aria-pressed={mode === "all-day"} onClick={() => setMode("all-day")} className={`rounded-[10px] px-3 py-3 text-[13px] font-bold ${mode === "all-day" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085]"}`}>All day</button>
            <button type="button" aria-pressed={mode === "hours"} onClick={() => setMode("hours")} className={`rounded-[10px] px-3 py-3 text-[13px] font-bold ${mode === "hours" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085]"}`}>Custom hours</button>
          </div>

          {mode === "hours" ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-[12px] font-bold text-[#344054]">From
                <input type="time" step={900} value={fromTime} onChange={(event) => setFromTime(event.target.value)}
                  className="mt-2 w-full min-w-0 rounded-[11px] border border-[#98A2B3] bg-white px-2 py-3 text-[13px]" />
              </label>
              <label className="text-[12px] font-bold text-[#344054]">Until
                <input type="time" step={900} value={untilTime} onChange={(event) => setUntilTime(event.target.value)}
                  className="mt-2 w-full min-w-0 rounded-[11px] border border-[#98A2B3] bg-white px-2 py-3 text-[13px]" />
              </label>
            </div>
          ) : (
            <p className="mt-4 rounded-[12px] bg-white p-3 text-[12px] leading-5 text-[#667085]">Blocks online reservations for the entire selected day (00:00–23:59). For today, choose Custom hours instead.</p>
          )}

          {conflictingAllDay && <p className="mt-4 rounded-xl bg-[#FFFAEB] p-3 text-[12px] font-semibold text-[#92400E]">One selected day has an existing booking. Switch to Custom hours to block only the free time.</p>}
          {error && <p role="alert" className="mt-4 rounded-xl bg-[#FEF3F2] p-3 text-[12px] font-semibold text-[#B42318]">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-xl bg-[#ECFDF3] p-3 text-[12px] font-semibold text-[#027A48]">{notice}</p>}
          <button type="button" onClick={() => void blockSelected()}
            disabled={busy || submitting || loading || selected.length === 0 || conflictingAllDay || (mode === "all-day" && hasToday)}
            className="mt-5 w-full rounded-[13px] bg-[#101828] px-5 py-4 text-[14px] font-bold text-white transition hover:bg-[#315C91] disabled:cursor-not-allowed disabled:opacity-40">
            {submitting ? "Updating availability…" : `⛔ Block ${selected.length || ""} ${selected.length === 1 ? "day" : "days"}`}
          </button>
          <p className="mt-2 text-center text-[11px] text-[#98A2B3]">Blocking dates never cancels existing reservations.</p>

          {selected.length === 1 && (
            <div className="mt-7 border-t border-[#D0D5DD] pt-5">
              <h5 className="text-[13px] font-extrabold text-[#101828]">On {prettyDay(selected[0])}</h5>
              {dayBlocks(selected[0]).length === 0 && dayBookings(selected[0]).length === 0 && (
                <p className="mt-2 text-[12px] text-[#667085]">No bookings or blocked time on this day.</p>
              )}
              {dayBlocks(selected[0]).map((block) => (
                <div key={block.id} className="mt-3 rounded-[12px] border border-[#FEC84B] bg-white p-3">
                  <p className="text-[12px] font-bold text-[#92400E]">{block.kind === "walk_in" ? "🚙 Walk-in" : "⛔ Unavailable"}</p>
                  <p className="mt-1 text-[12px] text-[#344054]">{formatMontrealTime(block.starts_at)}–{formatMontrealTime(block.ends_at)}</p>
                  {block.label && <p className="mt-1 text-[11px] text-[#667085]">{block.label}</p>}
                  <button type="button" disabled={busy || submitting} onClick={() => void onRemoveBlock(block.id)}
                    className="mt-2 rounded-[9px] border border-[#FEC84B] bg-[#FFFAEB] px-3 py-2 text-[11px] font-bold text-[#92400E] disabled:opacity-50">Remove block</button>
                </div>
              ))}
              {dayBookings(selected[0]).map((booking) => (
                <div key={booking.id} className="mt-3 rounded-[12px] border border-[#D0D5DD] bg-white p-3">
                  <p className="text-[12px] font-bold text-[#101828]">📅 {booking.service_name}</p>
                  <p className="mt-1 text-[12px] text-[#475467]">{formatMontrealTime(booking.starts_at)}–{formatMontrealTime(booking.ends_at)}</p>
                  <p className="mt-1 text-[12px] text-[#475467]">{booking.client_name} · {formatPriceCents(booking.price_cents)}</p>
                  <p className="mt-1 text-[11px] text-[#667085]">{booking.status.replaceAll("_", " ")}</p>
                  {booking.status === "confirmed" && new Date(booking.starts_at).getTime() > nowMs && (
                    <button type="button" disabled={busy || submitting || suspended || remaining === 0}
                      onClick={() => void onCancelBooking(booking)}
                      className="mt-3 rounded-[9px] border border-[#FDA29B] bg-[#FEF3F2] px-3 py-2 text-[11px] font-bold text-[#B42318] disabled:opacity-40">
                      Cancel booking ({remaining} left)
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
