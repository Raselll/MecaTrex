"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  formatMontrealDateTime,
  formatPriceCents,
  type GarageBooking,
} from "@/lib/booking";

type FinancialBooking = Pick<
  GarageBooking,
  | "id"
  | "client_name"
  | "garage_name"
  | "garage_address"
  | "service_name"
  | "vehicle_description"
  | "starts_at"
  | "ends_at"
  | "price_cents"
  | "status"
>;

type Props = {
  ownerId: string;
  kind: "provider" | "client";
};

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  timeZone: "America/Toronto",
});

const yearFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  timeZone: "America/Toronto",
});

function localMonth(date: string) {
  return Number(monthFormatter.format(new Date(date))) - 1;
}

function localYear(date: Date) {
  return Number(yearFormatter.format(date));
}

function amount(rows: FinancialBooking[]) {
  return rows.reduce(
    (sum, booking) => sum + (Number.isFinite(booking.price_cents) ? booking.price_cents : 0),
    0
  );
}

function csvCell(value: string | number) {
  let text = String(value ?? "");
  // Guard against spreadsheet formula injection in user-provided business names.
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export default function FinancialOverview({ ownerId, kind }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [initialYear] = useState(() => localYear(new Date()));
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState<number | null>(null);
  const [rows, setRows] = useState<FinancialBooking[]>([]);
  const [nextBookings, setNextBookings] = useState<FinancialBooking[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [refreshCount, setRefreshCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const provider = kind === "provider";

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // Jan 1 is always EST in Montreal (UTC-05:00). Use this boundary
        // so late-December/early-January reservations belong to the right year.
        const from = new Date(Date.UTC(year, 0, 1, 5)).toISOString();
        const to = new Date(Date.UTC(year + 1, 0, 1, 5)).toISOString();
        const ownerColumn = provider ? "provider_id" : "client_id";
        const selectFields =
          "id,client_name,garage_name,garage_address,service_name,vehicle_description,starts_at,ends_at,price_cents,status";

        const collected: FinancialBooking[] = [];
        let complete = false;

        for (let page = 0; page < MAX_PAGES; page++) {
          const { data, error: queryError } = await supabase
            .from("garage_bookings")
            .select(selectFields)
            .eq(ownerColumn, ownerId)
            .gte("starts_at", from)
            .lt("starts_at", to)
            .order("starts_at", { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (queryError) throw queryError;
          const batch = (data ?? []) as FinancialBooking[];
          collected.push(...batch);
          if (batch.length < PAGE_SIZE) {
            complete = true;
            break;
          }
        }

        if (!complete) {
          throw new Error("There are too many records to display safely. Please contact MECATREX support.");
        }

        // The nearest appointments are shown even if they fall in another year.
        const currentTime = new Date();
        const { data: upcoming, error: upcomingError } = await supabase
          .from("garage_bookings")
          .select(selectFields)
          .eq(ownerColumn, ownerId)
          .eq("status", "confirmed")
          .gt("ends_at", currentTime.toISOString())
          .order("starts_at", { ascending: true })
          .limit(3);

        if (upcomingError) throw upcomingError;
        if (!active) return;

        setRows(collected);
        setNextBookings((upcoming ?? []) as FinancialBooking[]);
        setNowMs(currentTime.getTime());
        setError("");
      } catch (cause) {
        if (!active) return;
        setRows([]);
        setNextBookings([]);
        setError(
          cause instanceof Error
            ? cause.message
            : "The financial overview could not be loaded."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [supabase, ownerId, year, refreshCount, provider]);

  const confirmed = useMemo(
    () => rows.filter((booking) => booking.status === "confirmed"),
    [rows]
  );

  const monthly = useMemo(() => {
    return MONTHS.map((label, index) => {
      const appointments = confirmed.filter(
        (booking) => localMonth(booking.starts_at) === index
      );
      const past = appointments.filter(
        (booking) => new Date(booking.ends_at).getTime() <= nowMs
      );
      const future = appointments.filter(
        (booking) => new Date(booking.ends_at).getTime() > nowMs
      );

      return {
        label,
        index,
        past: amount(past),
        future: amount(future),
        count: appointments.length,
      };
    });
  }, [confirmed, nowMs]);

  const pastValue = monthly.reduce((sum, entry) => sum + entry.past, 0);
  const upcomingValue = monthly.reduce((sum, entry) => sum + entry.future, 0);
  const chartMax = Math.max(
    1,
    ...monthly.map((entry) => Math.max(entry.past, entry.future))
  );

  const details = useMemo(
    () => confirmed
      .filter((booking) => month === null || localMonth(booking.starts_at) === month)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
    [confirmed, month]
  );

  const visibleDetails = showAll ? details : details.slice(0, 15);
  const upcomingCount = confirmed.filter(
    (booking) => new Date(booking.ends_at).getTime() > nowMs
  ).length;

  const years = Array.from(
    { length: 8 },
    (_, index) => initialYear + 2 - index
  );

  function chooseYear(nextYear: number) {
    setYear(nextYear);
    setMonth(null);
    setShowAll(false);
    setLoading(true);
    setError("");
  }

  function chooseMonth(nextMonth: number | null) {
    setMonth(nextMonth);
    setShowAll(false);
  }

  function downloadCsv() {
    const header = [
      "Date (Montreal)",
      provider ? "Customer" : "Garage",
      "Garage",
      "Service",
      "Vehicle",
      "Address",
      "Booked amount (CAD)",
      "Booking status",
      "Timing",
    ];
    const lines = [header.map(csvCell).join(",")];

    for (const booking of confirmed) {
      const fields = [
        formatMontrealDateTime(booking.starts_at),
        provider ? booking.client_name : booking.garage_name,
        booking.garage_name,
        booking.service_name,
        booking.vehicle_description,
        booking.garage_address,
        (booking.price_cents / 100).toFixed(2),
        booking.status,
        new Date(booking.ends_at).getTime() > nowMs ? "Upcoming" : "Past",
      ];
      lines.push(fields.map(csvCell).join(","));
    }

    const file = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mecatrex-" + (provider ? "business-" : "finances-") + year + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-label={provider ? "Business analytics" : "My finances"} className="space-y-5">
      <div className="rounded-[22px] border border-[#D5DFEA] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">
              {provider ? "Business insights" : "Your finances"}
            </p>
            <h3 className="mt-2 text-[27px] font-extrabold tracking-tight text-[#101828] sm:text-[33px]">
              {provider ? "Booking revenue overview" : "Your garage spending"}
            </h3>
            <p className="mt-2 max-w-[600px] text-[13px] leading-6 text-[#667085]">
              {provider
                ? "Follow confirmed appointment values, upcoming business and your monthly booking activity."
                : "Track the value of your past services, upcoming reservations and spending by month."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="mecatrex-financial-year">Select year</label>
            <select
              id="mecatrex-financial-year"
              value={year}
              onChange={(event) => chooseYear(Number(event.target.value))}
              className="rounded-xl border border-[#C8D4E1] bg-white px-4 py-3 text-[13px] font-bold text-[#344054]"
            >
              {years.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={loading || confirmed.length === 0}
              className="rounded-xl border border-[#C8D4E1] bg-white px-4 py-3 text-[13px] font-bold text-[#344054] transition hover:bg-[#EDF3FA] disabled:opacity-50"
            >
              <span aria-hidden="true">↓ </span>Download CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setRefreshCount((count) => count + 1);
              }}
              disabled={loading}
              className="rounded-xl bg-[#EDF3FA] px-4 py-3 text-[13px] font-bold text-[#315C91] hover:bg-[#DCEBFA] disabled:opacity-50"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-[14px] border border-[#D2DDEA] bg-[#F5F8FC] px-4 py-3 text-[12px] leading-5 text-[#52647D]">
          <span className="font-extrabold text-[#344054]">Important:</span>{" "}
          MECATREX does not process payments yet. These are the fixed prices recorded
          when appointments were booked, <strong>not verified payments, income or expenses</strong>.
          Cancelled reservations are excluded. Taxes or other charges may differ.
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-[#FDA29B] bg-[#FEF3F2] p-4 text-[13px] font-semibold text-[#B42318]">
            {error}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[18px] border border-[#D7E2EE] bg-white p-5">
            <p className="text-[12px] font-bold text-[#667085]">
              {provider ? "Past booked value" : "Past service value"}
            </p>
            <p className="mt-2 text-[27px] font-extrabold tracking-tight text-[#101828]">
              {loading ? "—" : formatPriceCents(pastValue)}
            </p>
            <p className="mt-2 text-[11px] text-[#667085]">Past confirmed appointments · {year}</p>
          </div>
          <div className="rounded-[18px] border border-[#DBD0F5] bg-[#F7F3FF] p-5">
            <p className="text-[12px] font-bold text-[#6A4D9A]">
              {provider ? "Upcoming estimated earnings" : "Upcoming estimated spending"}
            </p>
            <p className="mt-2 text-[27px] font-extrabold tracking-tight text-[#38245C]">
              {loading ? "—" : formatPriceCents(upcomingValue)}
            </p>
            <p className="mt-2 text-[11px] text-[#6A4D9A]">{upcomingCount} future confirmed reservations · {year}</p>
          </div>
          <div className="rounded-[18px] border border-[#D7E2EE] bg-white p-5">
            <p className="text-[12px] font-bold text-[#667085]">Confirmed reservations</p>
            <p className="mt-2 text-[27px] font-extrabold tracking-tight text-[#101828]">
              {loading ? "—" : confirmed.length}
            </p>
            <p className="mt-2 text-[11px] text-[#667085]">All confirmed appointments · {year}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-[#D5DFEA] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-[20px] font-extrabold text-[#101828]">Monthly breakdown</h4>
            <p className="mt-1 text-[12px] text-[#667085]">Click a month to explore its appointments.</p>
          </div>
          <button
            type="button"
            onClick={() => chooseMonth(null)}
            aria-pressed={month === null}
            className={"rounded-xl border px-3 py-2 text-[12px] font-bold transition " + (
              month === null
                ? "border-[#4771A6] bg-[#EDF3FA] text-[#315C91]"
                : "border-[#D0D5DD] bg-white text-[#475467] hover:bg-[#F8FAFC]"
            )}
          >
            All months
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-semibold text-[#475467]">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-[#4771A6]" />
            Past booked value
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-[#A58AD8]" />
            Upcoming estimated value
          </span>
        </div>

        <div className="mt-6 overflow-x-auto pb-3">
          <div className="grid min-w-[630px] grid-cols-12 gap-2 border-b border-[#D9E1E9]">
            {monthly.map((entry) => (
              <button
                type="button"
                key={entry.index}
                title={entry.label + ": " + formatPriceCents(entry.past) + " past, " + formatPriceCents(entry.future) + " upcoming"}
                aria-label={entry.label + " " + year + ", " + entry.count + " bookings. Past " + formatPriceCents(entry.past) + ", upcoming " + formatPriceCents(entry.future)}
                aria-pressed={month === entry.index}
                onClick={() => chooseMonth(entry.index)}
                className={"group flex min-w-0 flex-col items-center rounded-t-[12px] px-1 pt-3 transition hover:bg-[#F3F7FC] focus-visible:outline-[#4771A6] " + (
                  month === entry.index ? "bg-[#EDF3FA] ring-1 ring-inset ring-[#B4C9E5]" : ""
                )}
              >
                <div className="flex h-[176px] w-full items-end justify-center gap-1.5">
                  <span
                    className="w-[18px] rounded-t-md bg-[#4771A6] transition-all group-hover:bg-[#315C91]"
                    style={{ height: (entry.past ? Math.max(4, (entry.past / chartMax) * 164) : 2) + "px" }}
                  />
                  <span
                    className="w-[18px] rounded-t-md bg-[#A58AD8] transition-all group-hover:bg-[#8062B9]"
                    style={{ height: (entry.future ? Math.max(4, (entry.future / chartMax) * 164) : 2) + "px" }}
                  />
                </div>
                <span className="mt-3 mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[#475467]">
                  {entry.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {!loading && confirmed.length === 0 && (
          <p className="mt-4 rounded-xl bg-[#F8FAFC] px-4 py-5 text-center text-[13px] text-[#667085]">
            No confirmed bookings found for {year}. Your chart will update as reservations are made.
          </p>
        )}
      </div>

      <div className="rounded-[22px] border border-[#D5DFEA] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#4771A6]">Coming up</p>
            <h4 className="mt-1 text-[20px] font-extrabold text-[#101828]">Upcoming reservations</h4>
            <p className="mt-1 text-[12px] text-[#667085]">Your next confirmed appointments, including those in another year.</p>
          </div>
        </div>
        {loading ? (
          <p className="mt-5 text-[13px] text-[#667085]">Loading reservations…</p>
        ) : nextBookings.length === 0 ? (
          <p className="mt-5 rounded-xl bg-[#F8FAFC] p-5 text-[13px] text-[#667085]">No upcoming reservations.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {nextBookings.map((booking) => (
              <article key={booking.id} className="flex flex-col gap-3 rounded-[16px] border border-[#E4EAF1] bg-[#FAFBFD] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[12px] font-extrabold text-[#4771A6]">{formatMontrealDateTime(booking.starts_at)}</p>
                  <p className="mt-1 text-[15px] font-extrabold text-[#101828]">{booking.service_name}</p>
                  <p className="mt-1 text-[12px] text-[#667085]">
                    {provider ? booking.client_name : booking.garage_name}
                  </p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-[18px] font-extrabold text-[#101828]">{formatPriceCents(booking.price_cents)}</p>
                  <span className="mt-1 inline-block rounded-full bg-[#F3EDFF] px-2.5 py-1 text-[11px] font-bold text-[#7150A8]">Scheduled</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[22px] border border-[#D5DFEA] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#4771A6]">Detailed activity</p>
            <h4 className="mt-1 text-[20px] font-extrabold text-[#101828]">
              {month === null ? "All reservations in " + year : MONTHS[month] + " " + year}
            </h4>
            <p className="mt-1 text-[12px] text-[#667085]">
              {provider
                ? "Customer, service, date and fixed booking value."
                : "Garage, service, date and estimated cost."}
            </p>
          </div>
          <span className="rounded-full bg-[#EDF3FA] px-3 py-2 text-[12px] font-bold text-[#315C91]">
            {details.length} reservations
          </span>
        </div>

        {loading ? (
          <p className="mt-5 text-[13px] text-[#667085]">Loading activity…</p>
        ) : details.length === 0 ? (
          <p className="mt-5 rounded-xl bg-[#F8FAFC] p-5 text-[13px] text-[#667085]">No confirmed appointments in this period.</p>
        ) : (
          <>
            <div className="mt-5 divide-y divide-[#E7EDF4]">
              {visibleDetails.map((booking) => {
                const future = new Date(booking.ends_at).getTime() > nowMs;
                return (
                  <article key={booking.id} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#667085]">{formatMontrealDateTime(booking.starts_at)}</p>
                      <p className="mt-1 text-[14px] font-extrabold text-[#101828]">{booking.service_name}</p>
                      <p className="mt-1 truncate text-[12px] text-[#667085]">
                        {provider ? booking.client_name + " · " + booking.garage_name : booking.garage_name}
                      </p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-[17px] font-extrabold text-[#101828]">{formatPriceCents(booking.price_cents)}</p>
                      <p className={"mt-1 text-[11px] font-bold " + (future ? "text-[#7150A8]" : "text-[#4771A6]")}>
                        {future ? "Upcoming" : "Past appointment"}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
            {!showAll && details.length > visibleDetails.length && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-4 w-full rounded-xl border border-[#C8D4E1] bg-white px-4 py-3 text-[13px] font-bold text-[#315C91] hover:bg-[#EDF3FA]"
              >
                Show all {details.length} reservations
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
