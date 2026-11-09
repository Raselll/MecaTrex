
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  formatMontrealTime,
  formatPriceCents,
  montrealDate,
  plusCalendarMonths,
  type BusinessHour,
  type CalendarBlock,
  type GarageBooking,
} from "@/lib/booking";

/* =========================================================
   TYPES
========================================================= */

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
  onCancelBooking: (
    booking: GarageBooking
  ) => Promise<void>;
};

type PrivateNote = {
  block_id: string;
  private_note: string;
};

type PublicNote = {
  block_id: string;
  public_note: string;
};

const DAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const DAY_WIDTH = 104;

/* =========================================================
   DATE HELPERS
========================================================= */

function utcDate(iso: string) {
  const [year, month, day] =
    iso.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day)
  );
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(
  iso: string,
  numberOfDays: number
) {
  const date = utcDate(iso);

  date.setUTCDate(
    date.getUTCDate() + numberOfDays
  );

  return dateString(date);
}

function weekStart(iso: string) {
  return addDays(
    iso,
    -utcDate(iso).getUTCDay()
  );
}

function dayInMontreal(value: string) {
  const parts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));

  const part = (type: string) =>
    parts.find(
      (item) => item.type === type
    )?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function timeInMontreal(value: string) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "America/Toronto",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(new Date(value));
}

function prettyDay(iso: string) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    }
  ).format(utcDate(iso));
}

function longDay(iso: string) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "UTC",
      weekday: "long",
      month: "long",
      day: "numeric",
    }
  ).format(utcDate(iso));
}

/*
 * A block may cover part of a day or cross
 * midnight. Its ending instant is exclusive.
 */
function coversDay(
  block: CalendarBlock,
  day: string
) {
  const start = dayInMontreal(
    block.starts_at
  );

  const endMs =
    new Date(block.ends_at).getTime() - 1000;

  if (!Number.isFinite(endMs)) return false;

  const end = dayInMontreal(
    new Date(endMs).toISOString()
  );

  return day >= start && day <= end;
}

function isFullDayBlock(
  block: CalendarBlock,
  day: string
) {
  return (
    coversDay(block, day) &&
    dayInMontreal(block.starts_at) === day &&
    timeInMontreal(block.starts_at) ===
      "00:00" &&
    timeInMontreal(block.ends_at) ===
      "23:59"
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function AvailabilityBoard({
  providerId,
  bookings,
  blocks,
  hours,
  loading,
  busy,
  remaining,
  suspended,
  nowMs,
  onRefresh,
  onRemoveBlock,
  onCancelBooking,
}: Props) {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const today = montrealDate();

  const lastDay = plusCalendarMonths(
    today,
    6
  );

  const firstWeek = weekStart(today);
  const lastWeek = weekStart(lastDay);
  const calendarLastDay = addDays(
    lastWeek,
    6
  );

  const first = utcDate(firstWeek).getTime();
  const last = utcDate(calendarLastDay).getTime();

  const length = Math.round(
    (last - first) / 86400000
  ) + 1;

  const days = Array.from(
    { length },
    (_, i) => addDays(firstWeek, i)
  );

  const [visibleWeek, setVisibleWeek] =
    useState(() => firstWeek);

  const [selectedDays, setSelectedDays] =
    useState<string[]>([]);

  const [mode, setMode] = useState<
    "all-day" | "hours"
  >("all-day");

  const [fromTime, setFromTime] =
    useState("09:00");

  const [untilTime, setUntilTime] =
    useState("17:00");

  const [privateNote, setPrivateNote] =
    useState("");

  const [publicNote, setPublicNote] =
    useState("");

  const [privateNotes, setPrivateNotes] =
    useState<Record<string, string>>({});

  const [publicNotes, setPublicNotes] =
    useState<Record<string, string>>({});

  const [submitting, setSubmitting] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  const [error, setError] =
    useState("");

  const calendarRef =
    useRef<HTMLDivElement>(null);

  const draggingRef = useRef({
    active: false,
    moved: false,
    pointerStart: 0,
    scrollStart: 0,
  });

  const suppressNextClickRef =
    useRef(false);

  /* =======================================================
     READ EXISTING PRIVATE AND PUBLIC NOTES
  ======================================================= */

  useEffect(() => {
    let active = true;

    async function loadNotes() {
      if (!blocks.length) {
        setPrivateNotes({});
        setPublicNotes({});
        return;
      }

      const ids = blocks.map(
        (block) => block.id
      );

      const [privateResult, publicResult] =
        await Promise.all([
          supabase
            .from("garage_block_private_notes")
            .select("block_id,private_note")
            .in("block_id", ids),

          supabase
            .from("garage_block_public_notes")
            .select("block_id,public_note")
            .in("block_id", ids),
        ]);

      if (!active) return;

      if (privateResult.error) {
        console.warn(
          "Private block notes:",
          privateResult.error.message
        );
      } else {
        const values: Record<
          string,
          string
        > = {};

        for (const note of (
          privateResult.data ?? []
        ) as PrivateNote[]) {
          values[note.block_id] =
            note.private_note;
        }

        setPrivateNotes(values);
      }

      if (publicResult.error) {
        console.warn(
          "Public block notes:",
          publicResult.error.message
        );
      } else {
        const values: Record<
          string,
          string
        > = {};

        for (const note of (
          publicResult.data ?? []
        ) as PublicNote[]) {
          values[note.block_id] =
            note.public_note;
        }

        setPublicNotes(values);
      }
    }

    void loadNotes();

    return () => {
      active = false;
    };
  }, [blocks, supabase]);

  /* =======================================================
     CALENDAR DATA
  ======================================================= */

  const currentBookings = bookings.filter(
    (booking) =>
      booking.status === "confirmed"
  );

  const selected = selectedDays
    .filter(
      (day) =>
        DATE_ONLY.test(day) &&
        day >= today &&
        day <= lastDay
    )
    .sort();

  const selectedSet = new Set(selected);

  function dayBlocks(day: string) {
    return blocks.filter(
      (block) => coversDay(block, day)
    );
  }

  function dayBookings(day: string) {
    return bookings.filter(
      (booking) =>
        dayInMontreal(
          booking.starts_at
        ) === day
    );
  }

  function dayHasBooking(day: string) {
    return currentBookings.some(
      (booking) =>
        dayInMontreal(
          booking.starts_at
        ) === day
    );
  }

  function dayIsBlocked(day: string) {
    return dayBlocks(day).some(
      (block) =>
        block.kind === "unavailable" ||
        block.kind === "walk_in"
    );
  }

  function dayIsFullyBlocked(day: string) {
    return dayBlocks(day).some(
      (block) =>
        isFullDayBlock(block, day)
    );
  }

  const hasToday = selected.includes(
    today
  );

  const conflictingAllDay =
    mode === "all-day" &&
    selected.some(dayHasBooking);

  /* =======================================================
     SELECT A DAY
  ======================================================= */

  function choose(day: string) {
    if (
      day < today ||
      day > lastDay
    ) {
      return;
    }

    setNotice("");
    setError("");

    setSelectedDays((current) => {
      if (current.includes(day)) {
        return current.filter(
          (item) => item !== day
        );
      }

      return [...current, day].sort();
    });
  }

  /* =======================================================
     SMOOTH HORIZONTAL CALENDAR NAVIGATION
  ======================================================= */

  function moveWeek(direction: -1 | 1) {
    const element = calendarRef.current;

    if (!element) return;

    element.scrollBy({
      left: direction * DAY_WIDTH * 7,
      behavior: "smooth",
    });
  }

  function onCalendarScroll(
    event: React.UIEvent<HTMLDivElement>
  ) {
    const index = Math.max(
      0,
      Math.min(
        days.length - 7,
        Math.floor(
          event.currentTarget.scrollLeft /
            DAY_WIDTH
        )
      )
    );

    const displayed = addDays(
      firstWeek,
      index
    );

    setVisibleWeek((previous) =>
      previous === displayed
        ? previous
        : displayed
    );
  }

  function onCalendarPointerDown(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0
    ) {
      return;
    }

    suppressNextClickRef.current = false;

    draggingRef.current = {
      active: true,
      moved: false,
      pointerStart: event.clientX,
      scrollStart:
        event.currentTarget.scrollLeft,
    };
  }

  function onCalendarPointerMove(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    const drag = draggingRef.current;

    if (
      !drag.active ||
      event.pointerType !== "mouse"
    ) {
      return;
    }

    const movement =
      event.clientX - drag.pointerStart;

    if (
      Math.abs(movement) <= 5 &&
      !drag.moved
    ) {
      return;
    }

    drag.moved = true;

    if (
      !event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    }

    event.currentTarget.scrollLeft =
      drag.scrollStart - movement;
  }

  function onCalendarPointerUp() {
    suppressNextClickRef.current =
      draggingRef.current.moved;

    draggingRef.current.active = false;
  }

  /* =======================================================
     TRACKPAD AND SHIFT + MOUSE WHEEL

     Native horizontal scrolling remains enabled.
     Only Shift + vertical wheel is intercepted.
  ======================================================= */

  useEffect(() => {
    const element = calendarRef.current;

    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      if (
        !event.shiftKey ||
        Math.abs(event.deltaX) >
          Math.abs(event.deltaY)
      ) {
        return;
      }

      if (!event.deltaY) return;

      event.preventDefault();

      element.scrollLeft +=
        event.deltaY;
    };

    element.addEventListener(
      "wheel",
      onWheel,
      { passive: false }
    );

    return () =>
      element.removeEventListener(
        "wheel",
        onWheel
      );
  }, []);

  /* =======================================================
     BLOCK SELECTED DATES

     This preserves the original notes-aware RPC.
  ======================================================= */

  async function blockSelected() {
    setNotice("");
    setError("");

    if (!selected.length) {
      setError(
        "Select at least one date."
      );
      return;
    }

    if (
      mode === "all-day" &&
      hasToday
    ) {
      setError(
        "For today, choose Custom hours and select a future start time."
      );
      return;
    }

    if (conflictingAllDay) {
      setError(
        "One selected date already has a confirmed booking. Use Custom hours instead."
      );
      return;
    }

    const start =
      mode === "all-day"
        ? "00:00"
        : fromTime;

    const end =
      mode === "all-day"
        ? "23:59:59"
        : untilTime;

    if (start >= end) {
      setError(
        "The end time must be later than the start time."
      );
      return;
    }

    if (
      mode === "hours" &&
      selected.includes(today)
    ) {
      const currentTime =
        new Intl.DateTimeFormat(
          "en-GB",
          {
            timeZone: "America/Toronto",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }
        ).format(new Date(nowMs));

      if (fromTime <= currentTime) {
        setError(
          "Today's start time must be in the future."
        );
        return;
      }
    }

    setSubmitting(true);

    const succeeded: string[] = [];
    const failed: string[] = [];

    try {
      for (const day of selected) {
        const {
          error: insertError,
        } = await supabase.rpc(
          "add_garage_calendar_block_with_notes",
          {
            p_provider_id: providerId,
            p_day: day,
            p_start_time: start,
            p_end_time: end,
            p_kind: "unavailable",
            p_private_note:
              privateNote.trim(),
            p_public_note:
              publicNote.trim(),
          }
        );

        if (insertError) {
          failed.push(
            `${prettyDay(day)}: ${insertError.message}`
          );
        } else {
          succeeded.push(day);
        }
      }

      if (succeeded.length > 0) {
        await onRefresh();

        setNotice(
          `${succeeded.length} ${
            succeeded.length === 1
              ? "day"
              : "days"
          } blocked successfully.`
        );

        setPrivateNote("");
        setPublicNote("");
      }

      if (failed.length > 0) {
        setError(
          `Some dates could not be blocked: ${failed.join(
            " · "
          )}`
        );
      }

      setSelectedDays(
        failed.length
          ? selected.filter(
              (day) =>
                !succeeded.includes(day)
            )
          : []
      );
    } catch {
      setError(
        "Could not update the calendar. Please refresh and retry."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section
      aria-label="Garage availability calendar"
      className="overflow-hidden rounded-[26px] border border-[#BAC7D7] bg-white"
    >
      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E7EC] px-5 py-5 sm:px-7">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#4771A6]">
            Availability
          </p>

          <h3 className="mt-1 text-[24px] font-extrabold text-[#101828]">
            Manage blocked time
          </h3>

          <p className="mt-1 text-[13px] text-[#667085]">
            Swipe or drag smoothly through
            dates. Select days to block a
            full day or specific hours.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              calendarRef.current?.scrollTo({
                left: 0,
                behavior: "smooth",
              });

              setSelectedDays([today]);
              setError("");
              setNotice("");
            }}
            className="rounded-[11px] border border-[#D0D5DD] bg-white px-4 py-2.5 text-[12px] font-bold text-[#344054] hover:bg-[#F2F4F7]"
          >
            Today
          </button>

          <button
            type="button"
            aria-label="Previous week"
            disabled={
              visibleWeek <= firstWeek
            }
            onClick={() =>
              moveWeek(-1)
            }
            className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#D0D5DD] text-xl text-[#101828] hover:bg-[#F2F4F7] disabled:opacity-30"
          >
            ‹
          </button>

          <button
            type="button"
            aria-label="Next week"
            disabled={
              visibleWeek >= lastWeek
            }
            onClick={() =>
              moveWeek(1)
            }
            className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#D0D5DD] text-xl text-[#101828] hover:bg-[#F2F4F7] disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* =================================================
            CALENDAR LEFT SIDE
        ================================================= */}

        <div className="min-w-0 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-[18px] font-extrabold text-[#101828]">
              {prettyDay(visibleWeek)} –{" "}
              {prettyDay(
                addDays(visibleWeek, 6)
              )},{" "}
              {utcDate(
                addDays(visibleWeek, 6)
              ).getUTCFullYear()}
            </h4>

            <span className="rounded-full bg-[#EDF3FA] px-3 py-1.5 text-[12px] font-bold text-[#315C91]">
              {selected.length} selected
            </span>
          </div>

          <p className="mb-3 text-[12px] text-[#667085]">
            Drag dates horizontally like
            Turo, scroll on your trackpad,
            or use Shift + mouse wheel.
            Select multiple days if needed.
          </p>

          {/* CONTINUOUS SCROLLABLE DATE STRIP */}

          <div
            ref={calendarRef}
            onScroll={onCalendarScroll}
            onPointerDown={
              onCalendarPointerDown
            }
            onPointerMove={
              onCalendarPointerMove
            }
            onPointerUp={
              onCalendarPointerUp
            }
            onPointerCancel={
              onCalendarPointerUp
            }
            onClickCapture={(event) => {
              if (
                suppressNextClickRef.current
              ) {
                suppressNextClickRef.current =
                  false;

                event.preventDefault();
                event.stopPropagation();
              }
            }}
            className="min-w-0 cursor-grab overflow-x-auto overscroll-x-contain rounded-[17px] border border-[#D5DFEA] active:cursor-grabbing [scrollbar-width:thin]"
          >
            <div
              style={{
                width: `${
                  days.length * DAY_WIDTH
                }px`,
              }}
            >
              {/* WEEK DATES */}

              <div
                className="flex"
                role="group"
                aria-label="Select calendar dates"
              >
                {days.map((day) => {
                  const outOfRange =
                    day < today ||
                    day > lastDay;

                  const selectedDay =
                    selectedSet.has(day);

                  const isToday =
                    day === today;

                  const blocked =
                    dayIsBlocked(day);

                  const fullDay =
                    dayIsFullyBlocked(day);

                  const confirmed =
                    currentBookings.filter(
                      (booking) =>
                        dayInMontreal(
                          booking.starts_at
                        ) === day
                    );

                  const hour = hours.find(
                    (entry) =>
                      entry.weekday ===
                      utcDate(
                        day
                      ).getUTCDay()
                  );

                  const closed = hour
                    ? !hour.is_open
                    : true;

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={outOfRange}
                      aria-pressed={
                        selectedDay
                      }
                      aria-label={`${longDay(
                        day
                      )}, ${
                        blocked
                          ? "unavailable"
                          : "not blocked"
                      }, ${
                        confirmed.length
                      } confirmed bookings`}
                      onClick={() =>
                        choose(day)
                      }
                      style={{
                        flex: `0 0 ${DAY_WIDTH}px`,
                      }}
                      className={`relative min-h-[155px] border-r border-[#E4E7EC] p-3 text-left transition last:border-r-0 ${
                        blocked
                          ? "bg-[#FFF4E5]"
                          : isToday
                            ? "bg-[#D9F5EE]"
                            : "bg-white"
                      } ${
                        selectedDay
                          ? "ring-2 ring-inset ring-[#4771A6]"
                          : isToday
                            ? "ring-2 ring-inset ring-[#087F74]"
                            : "hover:bg-[#EDF3FA]"
                      } ${
                        outOfRange
                          ? "cursor-not-allowed opacity-35"
                          : "cursor-pointer"
                      }`}
                    >
                      <span className="block text-[11px] font-bold uppercase text-[#667085]">
                        {
                          DAYS[
                            utcDate(
                              day
                            ).getUTCDay()
                          ]
                        }
                      </span>

                      <span
                        className={`mt-2 block text-[29px] font-black ${
                          isToday
                            ? "text-[#064E4A]"
                            : "text-[#101828]"
                        }`}
                      >
                        {utcDate(
                          day
                        ).getUTCDate()}
                      </span>

                      {isToday && (
                        <span className="mt-1 inline-flex rounded-full bg-[#087F74] px-2 py-1 text-[10px] font-extrabold text-white">
                          TODAY
                        </span>
                      )}

                      {selectedDay && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#4771A6] text-[11px] font-bold text-white">
                          ✓
                        </span>
                      )}

                      <div className="mt-4 space-y-1">
                        {blocked ? (
                          <span className="block rounded-[6px] bg-[#FDE7B7] px-1.5 py-1 text-center text-[10px] font-extrabold text-[#92400E]">
                            {fullDay
                              ? "Closed all day"
                              : "Hours blocked"}
                          </span>
                        ) : (
                          <span
                            className={`block rounded-[6px] px-1.5 py-1 text-center text-[10px] font-bold ${
                              closed
                                ? "bg-[#F2F4F7] text-[#667085]"
                                : "bg-[#ECFDF3] text-[#027A48]"
                            }`}
                          >
                            {closed
                              ? "Closed"
                              : "Open hours"}
                          </span>
                        )}

                        {confirmed.length >
                          0 && (
                          <span className="block rounded-[6px] bg-[#DDEAFB] px-1.5 py-1 text-center text-[10px] font-bold text-[#315C91]">
                            {confirmed.length}{" "}
                            booked
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* =================================================
                  CONTINUOUS AVAILABILITY TIMELINE
              ================================================= */}

              <div className="border-t border-[#D5DFEA] bg-[#F8FAFC]">
                <div className="relative flex">
                  <div className="pointer-events-none absolute left-0 right-0 top-[19px] h-[3px] bg-[#D6DCE5]" />

                  {days.map((day) => {
                    const blocked =
                      dayIsBlocked(day);

                    const fullDay =
                      dayIsFullyBlocked(day);

                    return (
                      <div
                        key={day}
                        title={
                          blocked
                            ? `${longDay(
                                day
                              )}: ${
                                fullDay
                                  ? "Closed all day"
                                  : "Partially unavailable"
                              }`
                            : `${longDay(
                                day
                              )}: No manual block`
                        }
                        style={{
                          flex: `0 0 ${DAY_WIDTH}px`,
                        }}
                        className={`relative flex h-[57px] items-end justify-center border-r border-[#E4E7EC] pb-2 last:border-r-0 ${
                          blocked
                            ? "bg-[#FFF4E5]"
                            : "bg-transparent"
                        }`}
                      >
                        {blocked && (
                          <div
                            className={`absolute left-0 right-0 top-[15px] h-[11px] ${
                              fullDay
                                ? "bg-[#F59E0B]"
                                : "bg-[#F7B65C]"
                            }`}
                          />
                        )}

                        {blocked && (
                          <span className="relative z-10 text-[9px] font-extrabold text-[#92400E]">
                            {fullDay
                              ? "All day"
                              : "Partial"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* CONFIRMED BOOKINGS TRACK */}

                <div className="flex border-t border-[#E4E7EC]">
                  {days.map((day) => {
                    const booked =
                      dayHasBooking(day);

                    return (
                      <div
                        key={day}
                        style={{
                          flex: `0 0 ${DAY_WIDTH}px`,
                        }}
                        className="flex h-[24px] items-center justify-center border-r border-[#E4E7EC] last:border-r-0"
                        title={
                          booked
                            ? "Confirmed booking"
                            : "No confirmed booking"
                        }
                      >
                        {booked && (
                          <span className="h-[6px] w-[70%] rounded-full bg-[#4771A6]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* LEGEND */}

          <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-semibold text-[#667085]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#12B76A]" />
              Open hours
            </span>

            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#4771A6]" />
              Booked
            </span>

            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
              Unavailable
            </span>
          </div>

          <p className="mt-3 text-[12px] leading-5 text-[#98A2B3]">
            Montreal time. Orange sections
            represent manually blocked dates.
            Blue markers represent confirmed
            reservations. Existing bookings
            cannot be overwritten by a new block.
          </p>

          {loading && (
            <p className="mt-3 text-[12px] text-[#667085]">
              Refreshing calendar…
            </p>
          )}
        </div>

        {/* =================================================
            RIGHT SIDE — BLOCK CREATION
        ================================================= */}

        <aside className="border-t border-[#E4E7EC] bg-[#EDF3FA] p-5 lg:border-l lg:border-t-0 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#315C91]">
            Unavailability
          </p>

          <h4 className="mt-2 text-[20px] font-extrabold text-[#101828]">
            {selected.length > 0
              ? `${selected.length} ${
                  selected.length === 1
                    ? "day"
                    : "days"
                } selected`
              : "Select a date"}
          </h4>

          {selected.length === 1 && (
            <p className="mt-1 text-[13px] text-[#667085]">
              {longDay(selected[0])}
            </p>
          )}

          {selected.length > 1 && (
            <p className="mt-1 text-[12px] leading-5 text-[#667085]">
              {selected
                .map(prettyDay)
                .join(", ")}
            </p>
          )}

          {/* BLOCK TYPE */}

          <div
            className="mt-5 grid grid-cols-2 rounded-[12px] bg-[#E0E7F0] p-1"
            role="group"
            aria-label="Block type"
          >
            <button
              type="button"
              aria-pressed={
                mode === "all-day"
              }
              onClick={() =>
                setMode("all-day")
              }
              className={`rounded-[10px] px-3 py-3 text-[13px] font-bold ${
                mode === "all-day"
                  ? "bg-white text-[#101828] shadow-sm"
                  : "text-[#667085]"
              }`}
            >
              All day
            </button>

            <button
              type="button"
              aria-pressed={
                mode === "hours"
              }
              onClick={() =>
                setMode("hours")
              }
              className={`rounded-[10px] px-3 py-3 text-[13px] font-bold ${
                mode === "hours"
                  ? "bg-white text-[#101828] shadow-sm"
                  : "text-[#667085]"
              }`}
            >
              Custom hours
            </button>
          </div>

          {mode === "hours" ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-[12px] font-bold text-[#344054]">
                From

                <input
                  type="time"
                  step={900}
                  value={fromTime}
                  onChange={(event) =>
                    setFromTime(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full min-w-0 rounded-[11px] border border-[#98A2B3] bg-white px-2 py-3 text-[13px]"
                />
              </label>

              <label className="text-[12px] font-bold text-[#344054]">
                Until

                <input
                  type="time"
                  step={900}
                  value={untilTime}
                  onChange={(event) =>
                    setUntilTime(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full min-w-0 rounded-[11px] border border-[#98A2B3] bg-white px-2 py-3 text-[13px]"
                />
              </label>
            </div>
          ) : (
            <p className="mt-4 rounded-[12px] bg-white p-3 text-[12px] leading-5 text-[#667085]">
              Blocks online reservations for
              the entire selected day. For today,
              use Custom hours.
            </p>
          )}

          {/* PRIVATE NOTE */}

          <div className="mt-4 rounded-[15px] border border-[#C8D8EA] bg-white p-4">
            <label
              htmlFor="block-private-note"
              className="block text-[13px] font-extrabold text-[#101828]"
            >
              🔒 Private note (optional)
            </label>

            <p className="mt-2 text-[11px] leading-5 text-[#667085]">
              Only you can see this note.
              Example: personal appointment,
              staff training or maintenance.
            </p>

            <textarea
              id="block-private-note"
              value={privateNote}
              maxLength={160}
              rows={3}
              onChange={(event) =>
                setPrivateNote(
                  event.target.value
                )
              }
              placeholder="e.g. Staff meeting"
              className="mt-3 w-full resize-y rounded-[11px] border border-[#C8D8EA] bg-white px-3 py-3 text-[12px] text-[#101828]"
            />

            <p className="mt-1 text-right text-[10px] text-[#98A2B3]">
              {privateNote.length}/160
            </p>
          </div>

          {/* PUBLIC NOTE */}

          <div className="mt-4 rounded-[15px] border border-[#C8D8EA] bg-white p-4">
            <label
              htmlFor="block-public-note"
              className="block text-[13px] font-extrabold text-[#101828]"
            >
              🌐 Public note (optional)
            </label>

            <p className="mt-2 text-[11px] leading-5 text-[#667085]">
              Customers can see this reason.
              Example: closed for a public holiday.
              Avoid personal information.
            </p>

            <textarea
              id="block-public-note"
              value={publicNote}
              maxLength={160}
              rows={3}
              onChange={(event) =>
                setPublicNote(
                  event.target.value
                )
              }
              placeholder="e.g. Closed for public holiday"
              className="mt-3 w-full resize-y rounded-[11px] border border-[#C8D8EA] bg-white px-3 py-3 text-[12px] text-[#101828]"
            />

            <p className="mt-1 text-right text-[10px] text-[#98A2B3]">
              {publicNote.length}/160
            </p>
          </div>

          {/* VALIDATION */}

          {conflictingAllDay && (
            <p className="mt-4 rounded-[12px] bg-[#FFFAEB] p-3 text-[12px] font-semibold text-[#92400E]">
              One selected date already contains
              a confirmed appointment. Choose
              Custom hours instead.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-[12px] bg-[#FEF3F2] p-3 text-[12px] font-semibold text-[#B42318]"
            >
              {error}
            </p>
          )}

          {notice && (
            <p
              role="status"
              className="mt-4 rounded-[12px] bg-[#ECFDF3] p-3 text-[12px] font-semibold text-[#027A48]"
            >
              {notice}
            </p>
          )}

          <button
            type="button"
            onClick={() =>
              void blockSelected()
            }
            disabled={
              busy ||
              submitting ||
              loading ||
              selected.length === 0 ||
              conflictingAllDay ||
              (mode === "all-day" &&
                hasToday)
            }
            className="mt-5 w-full rounded-[13px] bg-[#4771A6] px-5 py-4 text-[14px] font-bold text-white transition hover:bg-[#315C91] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? "Updating availability…"
              : `⛔ Block ${
                  selected.length || ""
                } ${
                  selected.length === 1
                    ? "day"
                    : "days"
                }`}
          </button>

          <p className="mt-2 text-center text-[11px] text-[#98A2B3]">
            Blocking time never cancels
            existing appointments.
          </p>

          {/* =================================================
              SELECTED DATE DETAILS
          ================================================= */}

          {selected.length === 1 && (
            <div className="mt-7 border-t border-[#CAD5E2] pt-5">
              <h5 className="text-[13px] font-extrabold text-[#101828]">
                On {prettyDay(selected[0])}
              </h5>

              {dayBlocks(
                selected[0]
              ).length === 0 &&
                dayBookings(
                  selected[0]
                ).length === 0 && (
                  <p className="mt-2 text-[12px] text-[#667085]">
                    No bookings or blocked
                    time on this day.
                  </p>
                )}

              {/* BLOCK DETAILS */}

              {dayBlocks(
                selected[0]
              ).map((block) => (
                <div
                  key={block.id}
                  className="mt-3 rounded-[12px] border border-[#FEC84B] bg-white p-3"
                >
                  <p className="text-[12px] font-extrabold text-[#92400E]">
                    {block.kind ===
                    "walk_in"
                      ? "🚙 Walk-in"
                      : "⛔ Unavailable"}
                  </p>

                  <p className="mt-1 text-[12px] text-[#344054]">
                    {formatMontrealTime(
                      block.starts_at
                    )}
                    {" – "}
                    {formatMontrealTime(
                      block.ends_at
                    )}
                  </p>

                  {privateNotes[
                    block.id
                  ] && (
                    <div className="mt-3 rounded-[10px] bg-[#F2F4F7] p-3">
                      <p className="text-[11px] font-bold text-[#344054]">
                        🔒 Private note
                      </p>

                      <p className="mt-1 whitespace-pre-wrap text-[12px] text-[#475467]">
                        {
                          privateNotes[
                            block.id
                          ]
                        }
                      </p>
                    </div>
                  )}

                  {publicNotes[
                    block.id
                  ] && (
                    <div className="mt-3 rounded-[10px] bg-[#EDF3FA] p-3">
                      <p className="text-[11px] font-bold text-[#315C91]">
                        🌐 Public note
                      </p>

                      <p className="mt-1 whitespace-pre-wrap text-[12px] text-[#475467]">
                        {
                          publicNotes[
                            block.id
                          ]
                        }
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={
                      busy ||
                      submitting
                    }
                    onClick={() =>
                      void onRemoveBlock(
                        block.id
                      )
                    }
                    className="mt-3 rounded-[9px] border border-[#FEC84B] bg-[#FFFAEB] px-3 py-2 text-[11px] font-bold text-[#92400E] disabled:opacity-50"
                  >
                    Remove block
                  </button>
                </div>
              ))}

              {/* BOOKING DETAILS */}

              {dayBookings(
                selected[0]
              ).map((booking) => (
                <div
                  key={booking.id}
                  className="mt-3 rounded-[12px] border border-[#D0D5DD] bg-white p-3"
                >
                  <p className="text-[12px] font-bold text-[#101828]">
                    📅{" "}
                    {booking.service_name}
                  </p>

                  <p className="mt-1 text-[12px] text-[#475467]">
                    {formatMontrealTime(
                      booking.starts_at
                    )}
                    {" – "}
                    {formatMontrealTime(
                      booking.ends_at
                    )}
                  </p>

                  <p className="mt-1 text-[12px] text-[#475467]">
                    {booking.client_name}
                    {" · "}
                    {formatPriceCents(
                      booking.price_cents
                    )}
                  </p>

                  <p className="mt-1 text-[11px] text-[#667085]">
                    {booking.status.replaceAll(
                      "_",
                      " "
                    )}
                  </p>

                  {booking.status ===
                    "confirmed" &&
                    new Date(
                      booking.starts_at
                    ).getTime() > nowMs && (
                      <button
                        type="button"
                        disabled={
                          busy ||
                          submitting ||
                          suspended ||
                          remaining === 0
                        }
                        onClick={() =>
                          void onCancelBooking(
                            booking
                          )
                        }
                        className="mt-3 rounded-[9px] border border-[#FDA29B] bg-[#FEF3F2] px-3 py-2 text-[11px] font-bold text-[#B42318] disabled:opacity-40"
                      >
                        Cancel booking (
                        {remaining} left)
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
