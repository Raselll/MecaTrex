
"use client";
import {useSuccessToast} from "@/components/account/success-toasts";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { cancelGarageBooking } from "@/app/book/actions";
import AvailabilityBoard from "./availability-board";
import VehicleVisitCard from "./vehicle-visit-card";
import {
  BOOKING_CANCEL_LIMIT,
  WEEKDAYS,
  montrealDate,
  formatMontrealDateTime,
  type BusinessHour,
  type GarageBooking,
  type CalendarBlock,
} from "@/lib/booking";

const EMPTY_HOURS: BusinessHour[] = WEEKDAYS.map(
  (_, weekday) => ({
    weekday,
    provider_id: "",
    is_open: false,
    open_time: "09:00",
    close_time: "17:00",
  })
);

type PublicNoteRow = {
  block_id: string;
  public_note: string;
};

type PrivateNoteRow = {
  block_id: string;
  private_note: string;
};

export default function ProviderCalendar({
  providerId,
  initialCancelled,
  initiallySuspended,
  providerType,
}: {
  providerId: string;
  initialCancelled: number;
  initiallySuspended: boolean;
  providerType: "garage" | "towing";
}) {
  const supabase = useMemo(() => createClient(), []);

  const [hours, setHours] =
    useState<BusinessHour[]>(EMPTY_HOURS);

  const [savedHours,setSavedHours]=useState<BusinessHour[]>(EMPTY_HOURS);
  const [bookings, setBookings] =
    useState<GarageBooking[]>([]);

  const [towingStatuses, setTowingStatuses] =
    useState<{ booking_id: string; status: "pending" | "accepted" | "cancelled" }[]>([]);

  const [blocks, setBlocks] =
    useState<CalendarBlock[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  useSuccessToast(message);
  const [bookingJump, setBookingJump] = useState<{ date: string; token: number } | null>(null);
  const [error, setError] = useState("");

  const [remaining, setRemaining] = useState(
    Math.max(0, BOOKING_CANCEL_LIMIT - initialCancelled)
  );

  const [suspended, setSuspended] =
    useState(initiallySuspended);

  const refresh = useCallback(
    async (withHours = false) => {
      const [
        bookingResult,
        blockResult,
        providerResult,
        hourResult,
        towingResult,
      ] = await Promise.all([
        supabase
          .from("garage_bookings")
          .select("*")
          .eq("provider_id", providerId)
          .order("starts_at", { ascending: false })
          .limit(250),

        supabase
          .from("garage_calendar_blocks")
          .select(
            "id,provider_id,starts_at,ends_at,kind,label"
          )
          .eq("provider_id", providerId)
          .gte("ends_at", new Date().toISOString())
          .order("starts_at")
          .limit(250),

        supabase
          .from("service_providers")
          .select(
            "provider_cancellation_count,booking_suspended"
          )
          .eq("id", providerId)
          .single(),

        withHours
          ? supabase
              .from("garage_business_hours")
              .select("*")
              .eq("provider_id", providerId)
              .order("weekday")
          : Promise.resolve({ data: null, error: null }),
        providerType === "garage"
          ? supabase.from("towing_requests").select("booking_id,status")
              .eq("garage_provider_id", providerId)
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (!towingResult.error && towingResult.data) {
        setTowingStatuses(towingResult.data as { booking_id: string; status: "pending" | "accepted" | "cancelled" }[]);
      }

      if (bookingResult.error) {
        setError(bookingResult.error.message);
      } else {
        setBookings(
          (bookingResult.data ?? []) as GarageBooking[]
        );
      }

      if (blockResult.error) {
        setError(blockResult.error.message);
      } else {
        const blockRows = (
          blockResult.data ?? []
        ) as CalendarBlock[];

        if (blockRows.length > 0) {
          const ids = blockRows.map((block) => block.id);

          const [
            publicResult,
            privateResult,
          ] = await Promise.all([
            supabase
              .from("garage_block_public_notes")
              .select("block_id,public_note")
              .in("block_id", ids),

            supabase
              .from("garage_block_private_notes")
              .select("block_id,private_note")
              .in("block_id", ids),
          ]);

          if (publicResult.error) {
            setError(publicResult.error.message);
          }

          if (privateResult.error) {
            setError(privateResult.error.message);
          }

          const publicMap = new Map(
            (
              (publicResult.data ??
                []) as PublicNoteRow[]
            ).map((note) => [
              note.block_id,
              note.public_note,
            ])
          );

          const privateMap = new Map(
            (
              (privateResult.data ??
                []) as PrivateNoteRow[]
            ).map((note) => [
              note.block_id,
              note.private_note,
            ])
          );

          setBlocks(
            blockRows.map((block) => ({
              ...block,
              public_note: publicMap.get(block.id) ?? "",
              private_note: privateMap.get(block.id) ?? "",
            }))
          );
        } else {
          setBlocks([]);
        }
      }

      const providerData = providerResult.data as {
        provider_cancellation_count?: number;
        booking_suspended?: boolean;
      } | null;

      if (providerData) {
        setRemaining(
          Math.max(
            0,
            BOOKING_CANCEL_LIMIT -
              (providerData.provider_cancellation_count ?? 0)
          )
        );

        setSuspended(
          Boolean(providerData.booking_suspended)
        );
      }

      if (withHours && hourResult.data) {
        setHours(hourResult.data as BusinessHour[]);
        setSavedHours(hourResult.data as BusinessHour[]);
      }

      setLoading(false);
    },
    [providerId, supabase, providerType]
  );

  useEffect(() => {
    void refresh(true);

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
      void refresh();
    }, 20_000);

    return () => window.clearInterval(timer);
  }, [refresh]);

  function editHour(
    weekday: number,
    change: Partial<BusinessHour>
  ) {
    setHours((current) =>
      current.map((hour) =>
        hour.weekday === weekday
          ? { ...hour, ...change }
          : hour
      )
    );
  }

  async function saveHours() {
    if (hours.length !== 7) return;

    const changed = hours.filter(h=>{const prev=savedHours.find(x=>x.weekday===h.weekday);return !prev||prev.is_open!==h.is_open||prev.open_time.slice(0,5)!==h.open_time.slice(0,5)||prev.close_time.slice(0,5)!==h.close_time.slice(0,5)}).map(h=>WEEKDAYS[h.weekday]);
    setSavingHours(true);
    setMessage("");
    setError("");

    const { error: saveError } = await supabase.rpc(
      "save_garage_business_hours",
      {
        p_provider_id: providerId,
        p_hours: hours.map((hour) => ({
          weekday: hour.weekday,
          is_open: hour.is_open,
          open_time: hour.open_time,
          close_time: hour.close_time,
        })),
      }
    );

    setSavingHours(false);

    if (saveError) {
      setError(saveError.message);
    } else {
      setMessage(
        changed.length===1 ? `${changed[0]} availability updated successfully.` : changed.length>1 ? `Availability updated successfully for ${changed.join(", ")}.` : "Business hours saved successfully."
      );

      await refresh(true);
    }
  }

  async function removeBlock(blockId: string) {
    if (
      !window.confirm(
        "Remove this block and reopen the time if the garage is operating?"
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase.rpc(
      "remove_garage_calendar_block",
      {
        p_block_id: blockId,
      }
    );

    setBusy(false);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setMessage("Calendar block removed.");
      await refresh();
    }
  }

  async function cancelBooking(booking: GarageBooking) {
    if (remaining === 0 || suspended) return;

    const approved = window.confirm(
      "Cancel this customer’s booking? This action cannot be undone."
    );

    if (!approved) return;

    setBusy(true);
    setError("");
    setMessage("");

    const result = await cancelGarageBooking(booking.id);

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
    } else {
      setMessage(result.message);

      if (typeof result.remaining === "number") {
        setRemaining(result.remaining);

        if (result.remaining === 0) {
          setSuspended(true);
        }
      }

      await refresh();
    }
  }

  const upcoming = bookings.filter(
    (booking) =>
      booking.status === "confirmed" &&
      new Date(booking.ends_at).getTime() > nowMs
  );

  const nextBooking = [...upcoming].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at)
  )[0];

  function showNextBooking() {
    if (!nextBooking) return;
    const date = montrealDate(new Date(nextBooking.starts_at));
    setBookingJump((current) => ({ date, token: (current?.token ?? 0) + 1 }));
    window.requestAnimationFrame(() => {
      document.getElementById("garage-availability-board")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  return (
    <section
      id="garage-calendar"
      className="scroll-mt-24 space-y-6"
    >
      <div className="rounded-[25px] border border-[#E2D9D2] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#FF5B13]">
              Included with BandWhip · basic availability
            </p>

            <h2 className="mt-1 text-[27px] font-extrabold tracking-[-0.04em]">
              {providerType === "garage"
                ? "📅 Booking availability"
                : "🚚 Towing calendar"}
            </h2>

            <p className="mt-1 text-[14px] text-[#667085]">
              {providerType === "garage"
                ? "Manage available and unavailable times in Montreal time."
                : "Manage business hours and view assigned towing jobs."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-[12px] border border-[#E2D9D2] px-4 py-3 text-[13px] font-bold text-[#DD4E0D] hover:bg-[#FFF1E8]"
          >
            ↻ Refresh calendar
          </button>
        </div>

        {providerType === "garage" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={showNextBooking}
              disabled={!nextBooking}
              aria-label={nextBooking
                ? `Show next reservation on ${formatMontrealDateTime(nextBooking.starts_at)} in the calendar`
                : "No upcoming reservations"}
              className="group rounded-[15px] bg-[#FFF1E8] p-5 text-left transition hover:bg-[#DCEBFA] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF5B13] disabled:cursor-default disabled:opacity-70"
            >
              <p className="text-[12px] font-bold text-[#667085]">
                Upcoming bookings
              </p>
              <p className="mt-1 text-[28px] font-extrabold">
                {upcoming.length}
              </p>
              <p className="mt-2 text-[12px] font-bold text-[#DD4E0D]">
                {nextBooking
                  ? `Next: ${formatMontrealDateTime(nextBooking.starts_at)} →`
                  : "No upcoming reservations"}
              </p>
            </button>

            <div
              className={`rounded-[15px] p-5 ${
                suspended
                  ? "bg-[#FEF3F2]"
                  : "bg-[#ECFDF3]"
              }`}
            >
              <p className="text-[12px] font-bold text-[#667085]">
                Booking status
              </p>

              <p
                className={`mt-1 text-[17px] font-extrabold ${
                  suspended
                    ? "text-[#B42318]"
                    : "text-[#027A48]"
                }`}
              >
                {suspended
                  ? "Suspended · contact admin"
                  : "Ready when hours are set"}
              </p>
            </div>
          </div>
        )}

        {providerType === "garage" && towingStatuses.some((request) => request.status !== "cancelled") && (
          <div className="mt-5 rounded-[16px] border border-[#D7E4F0] bg-[#F7FAFD] p-4">
            <p className="text-[13px] font-extrabold text-[#101828]">🚛 Towing requests on your calendar</p>
            <div className="mt-3 space-y-2">
              {towingStatuses.filter((request) => request.status !== "cancelled")
                .map((request) => {
                  const linkedBooking = bookings.find((booking) => booking.id === request.booking_id);
                  if (!linkedBooking || linkedBooking.status !== "confirmed") return null;
                  return (
                    <div key={request.booking_id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#E1E9F2] bg-white px-3 py-3 text-[12px]">
                      <div>
                        <p className="font-bold text-[#344054]">{linkedBooking.client_name} · {linkedBooking.service_name}</p>
                        <p className="mt-1 text-[#667085]">{formatMontrealDateTime(linkedBooking.starts_at)}</p>
                      </div>
                      <span className={"rounded-full px-3 py-1.5 font-bold " +
                        (request.status === "accepted" ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FFF7E9] text-[#92400E]")}>
                        {request.status === "accepted" ? "✓ Fully confirmed · towing accepted" : "⏳ Garage reserved · towing pending"}
                      </span>
                    </div>
                  );
                })}
            </div>
            <p className="mt-2 text-[11px] text-[#667085]">The garage time remains reserved. With towing selected, the complete booking is only confirmed when a towing company accepts.</p>
          </div>
        )}

        {suspended && providerType === "garage" && (
          <p
            role="alert"
            className="mt-4 rounded-[13px] border border-[#FDA29B] bg-[#FEF3F2] p-4 text-[13px] font-bold text-[#B42318]"
          >
            Your garage reached its provider cancellation
            limit. New bookings are suspended until reviewed
            by an administrator. Existing bookings must still
            be honoured.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-[13px] bg-[#FEF3F2] p-4 text-[13px] font-semibold text-[#B42318]"
          >
            {error}
          </p>
        )}

        
      </div>

      <div className="rounded-[25px] border border-[#E2D9D2] bg-white p-6 sm:p-8">
        <h3 className="text-[22px] font-extrabold text-[#101828]">
          🕘 Regular business hours
        </h3>

        <p className="mt-1 text-[13px] leading-5 text-[#667085]">
          Choose the hours your business operates.
          Overnight hours are supported.
        </p>

        <div className="mt-5 space-y-3">
          {WEEKDAYS.map((day, weekday) => {
            const hour =
              hours.find((entry) => entry.weekday === weekday) ??
              EMPTY_HOURS[weekday];

            return (
              <div
                key={day}
                className="grid items-center gap-3 rounded-[14px] border border-[#D0D5DD] bg-[#F8FAFC] p-4 sm:grid-cols-[150px_1fr_1fr]"
              >
                <label className="flex cursor-pointer items-center gap-3 text-[14px] font-extrabold text-[#101828]">
                  <input
                    type="checkbox"
                    checked={hour.is_open}
                    onChange={(event) =>
                      editHour(weekday, {
                        is_open: event.target.checked,
                      })
                    }
                    className="h-5 w-5 accent-[#FF5B13]"
                  />
                  {day}
                </label>

                <label className="flex items-center gap-2 text-[12px] font-bold text-[#475467]">
                  Open
                  <input
                    type="time"
                    step={1800}
                    value={hour.open_time.slice(0, 5)}
                    disabled={!hour.is_open}
                    onChange={(event) =>
                      editHour(weekday, {
                        open_time: event.target.value,
                      })
                    }
                    className="min-w-0 flex-1 rounded-[11px] border border-[#98A2B3] bg-white px-3 py-2 text-[14px] text-[#101828] disabled:opacity-50"
                  />
                </label>

                <label className="flex items-center gap-2 text-[12px] font-bold text-[#475467]">
                  Close
                  <input
                    type="time"
                    step={1800}
                    value={hour.close_time.slice(0, 5)}
                    disabled={!hour.is_open}
                    onChange={(event) =>
                      editHour(weekday, {
                        close_time: event.target.value,
                      })
                    }
                    className="min-w-0 flex-1 rounded-[11px] border border-[#98A2B3] bg-white px-3 py-2 text-[14px] text-[#101828] disabled:opacity-50"
                  />
                </label>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          disabled={savingHours || hours.length !== 7}
          onClick={() => void saveHours()}
          className="mt-5 rounded-[13px] bg-[#FF5B13] px-6 py-3.5 text-[14px] font-bold text-white hover:bg-[#DD4E0D] disabled:opacity-50"
        >
          {savingHours
            ? "Saving…"
            : "Save business hours"}
        </button>

        <p className="mt-2 text-[12px] text-[#667085]">
          Changes are rejected if they conflict with
          existing confirmed appointments.
        </p>
      </div>

      {providerType === "garage" && (
        <div className="mb-6 rounded-[20px] border border-[#BDD0E4] bg-white p-4 sm:p-5">
          <h3 className="text-[17px] font-extrabold text-[#101828]">🚗 Vehicle drop-off and collection</h3>
          <p className="mt-2 text-[12px] leading-5 text-[#667085]">
            Two hours before an appointment, reveal the unique garage handoff code.
            Share it only after receiving the car. Once verified, mark the service
            completed, email or call the client, and wait for their pickup confirmation.
          </p>
          {bookings
            .filter((booking) => booking.status === "confirmed" &&
              new Date(booking.starts_at).getTime() >= nowMs - 48 * 60 * 60_000 &&
              new Date(booking.starts_at).getTime() < nowMs + 7 * 24 * 60 * 60_000)
            .sort((a,b) => a.starts_at.localeCompare(b.starts_at))
            .slice(0, 15)
            .map((booking) => (
              <div key={booking.id} className="mt-4 rounded-xl border border-[#E1E8F1] p-3">
                <p className="text-[12px] font-extrabold text-[#101828]">
                  {booking.client_name} · {booking.service_name}
                </p>
                <p className="mt-1 text-[11px] text-[#667085]">{formatMontrealDateTime(booking.starts_at)}</p>
                <VehicleVisitCard booking={booking} mode="garage" />
              </div>
            ))}
        </div>
      )}

      {providerType === "garage" && (
        <AvailabilityBoard
          providerId={providerId}
          bookings={bookings}
          jumpToBooking={bookingJump}
          blocks={blocks}
          hours={hours}
          loading={loading}
          busy={busy}
          remaining={remaining}
          suspended={suspended}
          nowMs={nowMs}
          onRefresh={() => refresh()}
          onRemoveBlock={removeBlock}
          onCancelBooking={cancelBooking}
        />
      )}
    </section>
  );
}
