"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Mode = "asap" | "scheduled";

type SavedWhen = {
  mode: Mode;
  date?: string;
  time?: string;
  version?: number;
};

const STORAGE_KEY = "mecatrex-service-when";
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const TIME_PATTERN = /^([01]\d|2[0-3]):(00|30)$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return toIsoDate(parsed) === value ? parsed : null;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// The selectable period ends exactly six calendar months from today.
function addCalendarMonthsClamped(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hour, minute));
}

function formatSelection(selection: SavedWhen) {
  if (selection.mode === "asap") return "ASAP";

  const date = parseIsoDate(selection.date ?? "");
  if (!date || !selection.time) return "Choose when";

  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(date);

  return `${dateLabel} · ${formatTime(selection.time)}`;
}

function isValidScheduledSelection(selection: SavedWhen, now: Date) {
  const date = parseIsoDate(selection.date ?? "");
  const time = selection.time ?? "";
  if (!date || !TIME_PATTERN.test(time)) return false;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const maxDate = addCalendarMonthsClamped(today, 6);
  if (date < today || date > maxDate) return false;

  if (sameDay(date, today)) {
    const [hour, minute] = time.split(":").map(Number);
    if (hour * 60 + minute <= now.getHours() * 60 + now.getMinutes()) return false;
  }

  return true;
}

export default function WhenPicker() {
  const [clock, setClock] = useState(() => new Date());
  const [selection, setSelection] = useState<SavedWhen | null>(null);
  const [open, setOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<Mode | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [month, setMonth] = useState(() => new Date(clock.getFullYear(), clock.getMonth(), 1));

  const today = useMemo(
    () => new Date(clock.getFullYear(), clock.getMonth(), clock.getDate()),
    [clock],
  );
  const maxDate = useMemo(() => addCalendarMonthsClamped(today, 6), [today]);
  const minDateIso = toIsoDate(today);
  const maxDateIso = toIsoDate(maxDate);

  // Keep date/time restrictions correct when the tab stays open overnight.
  useEffect(() => {
    const refresh = () => setClock(new Date());
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // Restore only an explicitly selected time. The previous version silently
  // stored ASAP on first visit; that old automatic value must not become a choice.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const stored: SavedWhen = JSON.parse(raw);
      const now = new Date();
      if (stored.mode === "scheduled" && isValidScheduledSelection(stored, now)) {
        setSelection({ mode: "scheduled", date: stored.date, time: stored.time, version: 2 });
      } else if (stored.mode === "asap" && stored.version === 2) {
        setSelection({ mode: "asap", version: 2 });
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const activeSelection =
    selection?.mode === "scheduled" && !isValidScheduledSelection(selection, clock)
      ? null
      : selection;

  function openPicker() {
    const valid = activeSelection;
    setDraftMode(valid?.mode ?? null);
    setDraftDate(valid?.mode === "scheduled" ? valid.date ?? "" : "");
    setDraftTime(valid?.mode === "scheduled" ? valid.time ?? "" : "");

    const date = valid?.mode === "scheduled" ? parseIsoDate(valid.date ?? "") : null;
    setMonth(new Date((date ?? today).getFullYear(), (date ?? today).getMonth(), 1));
    setOpen(true);
  }

  function saveSelection(next: SavedWhen) {
    const saved: SavedWhen = { ...next, version: 2 };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    setSelection(saved);
    setOpen(false);
  }

  function clearSelection() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSelection(null);
    setDraftMode(null);
    setDraftDate("");
    setDraftTime("");
    setOpen(false);
  }

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);

  const timeOptions = useMemo(() => {
    const options: string[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      for (const minute of [0, 30]) options.push(`${pad(hour)}:${pad(minute)}`);
    }
    return options;
  }, []);

  const dateWithinRange = draftDate >= minDateIso && draftDate <= maxDateIso;
  const chosenMinutes = draftTime
    ? Number(draftTime.slice(0, 2)) * 60 + Number(draftTime.slice(3, 5))
    : -1;
  const nowMinutes = clock.getHours() * 60 + clock.getMinutes();
  const canConfirm =
    draftMode === "scheduled" &&
    dateWithinRange &&
    TIME_PATTERN.test(draftTime) &&
    (draftDate !== minDateIso || chosenMinutes > nowMinutes);

  return (
    <div className="group relative min-h-[110px] overflow-hidden rounded-[20px] bg-white transition hover:bg-[#F8FAFC] focus-within:bg-[#F8FAFC]">
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={activeSelection ? `When: ${formatSelection(activeSelection)}. Change selection` : "Choose when you need service"}
        className={`flex min-h-[110px] w-full flex-col items-center justify-center rounded-[20px] px-4 py-4 text-center outline-none transition-transform focus-visible:ring-4 focus-visible:ring-[#4771A6]/20 ${activeSelection ? "max-sm:-translate-y-2 sm:group-hover:-translate-y-2 sm:group-focus-within:-translate-y-2" : ""}`}
      >
        <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">When</span>
        <span className="mt-2 max-w-full truncate text-[19px] font-semibold text-[#101828]">
          {activeSelection ? formatSelection(activeSelection) : "Choose when"}
        </span>
        {!activeSelection && (
          <span className="mt-1.5 text-[13px] font-bold text-[#4771A6]">Choose timing</span>
        )}
      </button>

      {activeSelection && (
        <div className="absolute inset-x-3 bottom-2 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center opacity-100 transition-opacity sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={openPicker}
            className="rounded-lg px-1 py-1 text-[12px] font-bold leading-4 text-[#4771A6] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4771A6]"
          >
            Change time
          </button>
          <span aria-hidden="true" className="text-[#D0D5DD]">·</span>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-lg px-1 py-1 text-[12px] font-bold leading-4 text-[#667085] hover:text-[#B42318] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4771A6]"
          >
            Clear saved
          </button>
        </div>
      )}

      {open && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-[#101828]/65 p-4 sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose when you need vehicle service"
            className="max-h-[calc(100dvh-32px)] w-full max-w-[430px] overflow-y-auto rounded-[24px] border border-[#E4E7EC] bg-white p-5 text-left shadow-[0_24px_70px_rgba(16,24,40,0.25)] sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-[#4771A6]">Service timing</p>
                <h2 className="mt-1 text-[22px] font-bold text-[#101828]">When do you need help?</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close calendar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2F4F7] text-[22px] text-[#344054] hover:bg-[#E4E7EC]"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-[#F2F4F7] p-1.5">
              <button
                type="button"
                onClick={() => saveSelection({ mode: "asap" })}
                className={`rounded-[12px] px-3 py-3 text-[13px] font-bold transition ${draftMode === "asap" ? "bg-white text-[#101828] shadow-sm" : "text-[#344054] hover:bg-white/70"}`}
              >
                ⚡ ASAP
              </button>
              <button
                type="button"
                onClick={() => setDraftMode("scheduled")}
                className={`rounded-[12px] px-3 py-3 text-[13px] font-bold transition ${draftMode === "scheduled" ? "bg-white text-[#101828] shadow-sm" : "text-[#344054] hover:bg-white/70"}`}
              >
                📅 Date &amp; time
              </button>
            </div>

            {draftMode === "scheduled" && (
              <>
                <div className="mt-5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
                    disabled={month.getFullYear() === today.getFullYear() && month.getMonth() <= today.getMonth()}
                    aria-label="Previous month"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EAECF0] text-[#475467] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <p className="text-[15px] font-bold text-[#101828]">
                    {new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" }).format(month)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
                    disabled={month.getFullYear() === maxDate.getFullYear() && month.getMonth() >= maxDate.getMonth()}
                    aria-label="Next month"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EAECF0] text-[#475467] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ›
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="py-1 text-[11px] font-bold uppercase text-[#98A2B3]">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day) => {
                    const disabled = day < today || day > maxDate || day.getMonth() !== month.getMonth();
                    const iso = toIsoDate(day);
                    const selected = draftDate === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          setDraftDate(iso);
                          setDraftTime("");
                        }}
                        className={`h-10 rounded-[11px] text-[13px] font-semibold transition ${selected ? "bg-[#4771A6] text-white" : disabled ? "text-[#D0D5DD]" : sameDay(day, today) ? "bg-[#EDF3FA] text-[#315C91] hover:bg-[#DCE8F5]" : "text-[#344054] hover:bg-[#F2F4F7]"}`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.1em] text-[#667085]">Time</span>
                  <select
                    value={draftTime}
                    onChange={(event) => setDraftTime(event.target.value)}
                    disabled={!dateWithinRange}
                    className="h-[48px] w-full rounded-[13px] border border-[#D0D5DD] bg-white px-4 text-[14px] font-semibold text-[#101828] outline-none focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10 disabled:opacity-50"
                  >
                    <option value="">Choose a time</option>
                    {timeOptions.map((time) => {
                      const [hour, minute] = time.split(":").map(Number);
                      const passed = draftDate === minDateIso && hour * 60 + minute <= nowMinutes;
                      return <option key={time} value={time} disabled={passed}>{formatTime(time)}</option>;
                    })}
                  </select>
                </label>

                <button
                  type="button"
                  disabled={!canConfirm}
                  onClick={() => saveSelection({ mode: "scheduled", date: draftDate, time: draftTime })}
                  className="mt-4 w-full rounded-[13px] bg-[#101828] px-4 py-3.5 text-[14px] font-bold text-white transition hover:bg-[#4771A6] disabled:cursor-not-allowed disabled:bg-[#D0D5DD]"
                >
                  Confirm date &amp; time
                </button>
              </>
            )}

            <p className="mt-4 text-center text-[12px] leading-5 text-[#667085]">
              Choose ASAP or a date up to {new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", year: "numeric" }).format(maxDate)}.
              {draftMode === "scheduled" ? " Times are available every 30 minutes, from midnight to 11:30 PM." : ""}
            </p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
