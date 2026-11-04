"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Mode = "asap" | "scheduled";

type SavedWhen = {
  mode: Mode;
  date?: string;
  time?: string;
};

const STORAGE_KEY = "mecatrex-service-when";
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatSummary(mode: Mode, date: string, time: string) {
  if (mode === "asap") return "ASAP";
  if (!date) return "Choose date & time";

  const dateValue = parseIsoDate(date);
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(dateValue);

  if (!time) return dateLabel;

  const [hour, minute] = time.split(":").map(Number);
  const timeDate = new Date(2000, 0, 1, hour, minute);
  const timeLabel = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(timeDate);

  return `${dateLabel} · ${timeLabel}`;
}

export default function WhenPicker() {
  const today = useMemo(() => {
    const value = new Date();
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }, []);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("asap");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as SavedWhen;
      if (parsed.mode === "scheduled") {
        setMode("scheduled");
        setSelectedDate(parsed.date ?? "");
        setSelectedTime(parsed.time ?? "");
        if (parsed.date) {
          const date = parseIsoDate(parsed.date);
          setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const payload: SavedWhen = {
      mode,
      ...(mode === "scheduled" ? { date: selectedDate, time: selectedTime } : {}),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [mode, selectedDate, selectedTime]);

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

  const calendarDays = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const value = new Date(start);
      value.setDate(start.getDate() + index);
      return value;
    });
  }, [month]);

  const timeOptions = useMemo(() => {
    const result: string[] = [];
    for (let hour = 6; hour <= 22; hour += 1) {
      for (const minute of [0, 30]) {
        if (hour === 22 && minute === 30) continue;
        result.push(`${pad(hour)}:${pad(minute)}`);
      }
    }
    return result;
  }, []);

  return (
    <div className="relative min-h-[110px] rounded-[20px] border border-[#DCE8F5] bg-[#F8FAFC] transition hover:border-[#83A7D3] hover:bg-[#EDF3FA]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group flex min-h-[110px] w-full flex-col items-center justify-center rounded-[20px] px-4 py-4 text-center outline-none focus-visible:ring-4 focus-visible:ring-[#4771A6]/20"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Choose ASAP or schedule a service date and time"
      >
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">When</p>
        <p className="mt-2 max-w-[190px] truncate text-[19px] font-bold text-[#101828]">
          {formatSummary(mode, selectedDate, selectedTime)}
        </p>
        <span className="mt-1 flex items-center gap-1.5 text-[13px] font-bold text-[#4771A6] group-hover:underline">
          <span aria-hidden="true">📅</span>
          {mode === "asap" ? "Choose date & time" : "Change date & time"}
          <span aria-hidden="true" className="text-[16px]">⌄</span>
        </span>
      </button>

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
              <button type="button" onClick={() => setOpen(false)} aria-label="Close calendar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2F4F7] text-[22px] text-[#344054] hover:bg-[#E4E7EC]">×</button>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-[#F2F4F7] p-1.5">
            <button
              type="button"
              onClick={() => {
                setMode("asap");
                setOpen(false);
              }}
              className={`rounded-[12px] px-3 py-3 text-[13px] font-bold transition ${mode === "asap" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085]"}`}
            >
              ⚡ ASAP
            </button>
            <button
              type="button"
              onClick={() => setMode("scheduled")}
              className={`rounded-[12px] px-3 py-3 text-[13px] font-bold transition ${mode === "scheduled" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085]"}`}
            >
              📅 Date & time
            </button>
          </div>

          {mode === "scheduled" && (
            <>
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
                  disabled={month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EAECF0] text-[#475467] disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <p className="text-[15px] font-bold text-[#101828]">
                  {new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" }).format(month)}
                </p>
                <button
                  type="button"
                  onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EAECF0] text-[#475467]"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-1 text-[11px] font-bold uppercase text-[#98A2B3]">{day}</div>
                ))}
                {calendarDays.map((day) => {
                  const disabled = day < today || day.getMonth() !== month.getMonth();
                  const iso = toIsoDate(day);
                  const selected = selectedDate === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedDate(iso)}
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
                  value={selectedTime}
                  onChange={(event) => setSelectedTime(event.target.value)}
                  className="h-[48px] w-full rounded-[13px] border border-[#D0D5DD] bg-white px-4 text-[14px] font-semibold text-[#101828] outline-none focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
                >
                  <option value="">Choose a time</option>
                  {timeOptions.map((time) => {
                    const [hour, minute] = time.split(":").map(Number);
                    const label = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hour, minute));
                    return <option key={time} value={time}>{label}</option>;
                  })}
                </select>
              </label>

              <button
                type="button"
                disabled={!selectedDate || !selectedTime}
                onClick={() => setOpen(false)}
                className="mt-4 w-full rounded-[13px] bg-[#101828] px-4 py-3.5 text-[14px] font-bold text-white transition hover:bg-[#4771A6] disabled:cursor-not-allowed disabled:bg-[#D0D5DD]"
              >
                Use this time
              </button>
            </>
          )}

            <p className="mt-4 text-center text-[12px] leading-5 text-[#667085]">
              Your choice sets a search preference. Garage-specific availability is coming soon.
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
