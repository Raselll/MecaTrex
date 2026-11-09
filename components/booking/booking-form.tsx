
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createGarageBooking } from "@/app/book/actions";
import {
  formatHour,
  formatPriceCents,
  montrealDate,
  plusCalendarMonths,
  type BusinessHour,
} from "@/lib/booking";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
};

type Slot = {
  slot_time: string;
  starts_at: string;
  ends_at: string;
};

type PublicBlockNote = {
  public_note: string;
  starts_at: string;
  ends_at: string;
};

type Props = {
  providerId: string;
  services: Service[];
  hours: BusinessHour[];
  initialService?: string;
  canConfirm: boolean;
};

export default function BookingForm({
  providerId,
  services,
  hours,
  initialService,
  canConfirm,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [today, setToday] = useState(
    () => montrealDate()
  );

  const [serviceId, setServiceId] =
    useState(
      initialService &&
        services.some(
          (s) => s.id === initialService
        )
        ? initialService
        : services[0]?.id ?? ""
    );

  const [day, setDay] = useState(today);
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [publicNotes, setPublicNotes] =
    useState<PublicBlockNote[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [booking, setBooking] =
    useState(false);

  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [vehicle, setVehicle] =
    useState("");

  const [
    preferredTime,
    setPreferredTime,
  ] = useState("");

  const selectedService = services.find(
    (service) => service.id === serviceId
  );

  const maxDay = plusCalendarMonths(
    today,
    6
  );

  const hoursConfigured = hours.some(
    (hour) => hour.is_open
  );

  /* =====================================================
     RESTORE SAVED VEHICLE AND APPOINTMENT PREFERENCES
  ===================================================== */

  useEffect(() => {
    try {
      const storedVehicle =
        window.localStorage.getItem(
          "mecatrex-selected-vehicle"
        );

      if (storedVehicle) {
        const parsed = JSON.parse(
          storedVehicle
        ) as Record<string, unknown>;

        const description = [
          parsed.year,
          parsed.make,
          parsed.model,
          parsed.color,
        ]
          .filter(
            (item) =>
              typeof item === "string" ||
              typeof item === "number"
          )
          .map(String)
          .join(" ")
          .slice(0, 120);

        if (description) {
          setVehicle(description);
        }
      }

      const storedWhen =
        window.localStorage.getItem(
          "mecatrex-service-when"
        );

      if (storedWhen) {
        const saved = JSON.parse(
          storedWhen
        ) as {
          mode?: string;
          date?: string;
          time?: string;
        };

        if (
          saved.mode === "scheduled" &&
          saved.date &&
          saved.date >= montrealDate() &&
          saved.date <=
            plusCalendarMonths(
              montrealDate(),
              6
            )
        ) {
          setDay(saved.date);

          if (
            saved.time &&
            /^([01]\d|2[0-3]):(00|30)$/.test(
              saved.time
            )
          ) {
            setPreferredTime(saved.time);
          }
        }
      }
    } catch {
      // Ignore malformed saved preferences.
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(
      () => {
        const value = montrealDate();

        setToday(value);

        setDay((current) =>
          current < value
            ? value
            : current
        );
      },
      30_000
    );

    return () =>
      window.clearInterval(timer);
  }, []);

  /* =====================================================
     FETCH LIVE SLOTS AND PUBLIC BLOCK NOTES
  ===================================================== */

  useEffect(() => {
    if (
      !serviceId ||
      !day ||
      day < today ||
      day > maxDay
    ) {
      setSlots([]);
      setSlot("");
      setPublicNotes([]);
      return;
    }

    let active = true;

    setLoading(true);
    setError("");
    setSlot("");
    setPublicNotes([]);

    async function load() {
      const [
        slotsResult,
        notesResult,
      ] = await Promise.all([
        supabase.rpc(
          "garage_available_slots",
          {
            p_provider_id: providerId,
            p_service_id: serviceId,
            p_day: day,
          }
        ),

        supabase.rpc(
          "get_garage_public_block_notes",
          {
            p_provider_id: providerId,
            p_day: day,
          }
        ),
      ]);

      if (!active) return;

      setLoading(false);

      if (slotsResult.error) {
        setSlots([]);

        setError(
          "Live availability is not ready. Make sure the booking migration is installed in Supabase."
        );
      } else {
        const available = (
          slotsResult.data ?? []
        ) as Slot[];

        setSlots(available);

        if (
          preferredTime &&
          available.some(
            (candidate) =>
              candidate.slot_time ===
              preferredTime
          )
        ) {
          setSlot(preferredTime);
        }
      }

      if (notesResult.error) {
        console.warn(
          "Public closure notes could not be loaded:",
          notesResult.error.message
        );

        setPublicNotes([]);
      } else {
        setPublicNotes(
          (notesResult.data ??
            []) as PublicBlockNote[]
        );
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [
    providerId,
    serviceId,
    day,
    today,
    maxDay,
    preferredTime,
    supabase,
  ]);

  /* =====================================================
     NEXT DATE
  ===================================================== */

  function nextDay() {
    const [y, m, d] = day
      .split("-")
      .map(Number);

    const date = new Date(
      Date.UTC(y, m - 1, d + 1)
    );

    const value = date
      .toISOString()
      .slice(0, 10);

    if (value <= maxDay) {
      setDay(value);
    }
  }

  /* =====================================================
     CONFIRM BOOKING
  ===================================================== */

  async function submit() {
    if (
      !selectedService ||
      !slot ||
      booking ||
      !canConfirm
    ) {
      return;
    }

    setBooking(true);
    setError("");

    const form = new FormData();

    form.set(
      "provider_id",
      providerId
    );
    form.set(
      "service_id",
      serviceId
    );
    form.set("day", day);
    form.set("time", slot);
    form.set("note", note);
    form.set("vehicle", vehicle);

    const result =
      await createGarageBooking(form);

    setBooking(false);

    if (!result.ok) {
      setError(result.error);

      const { data } =
        await supabase.rpc(
          "garage_available_slots",
          {
            p_provider_id: providerId,
            p_service_id: serviceId,
            p_day: day,
          }
        );

      setSlots((data ?? []) as Slot[]);
      setSlot("");
      return;
    }

    router.push("/account?booked=1");
    router.refresh();
  }

  const nextPath =
    `/book/${providerId}?service=` +
    encodeURIComponent(serviceId);

  const morning = slots.filter(
    (x) =>
      Number(
        x.slot_time.slice(0, 2)
      ) < 12
  );

  const afternoon = slots.filter(
    (x) =>
      Number(
        x.slot_time.slice(0, 2)
      ) >= 12 &&
      Number(
        x.slot_time.slice(0, 2)
      ) < 18
  );

  const evening = slots.filter(
    (x) =>
      Number(
        x.slot_time.slice(0, 2)
      ) >= 18
  );

  return (
    <div className="space-y-6">
      {/* ================================================
          STEP 1: SERVICE
      ================================================ */}

      <section className="rounded-[24px] border border-[#BAC7D7] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EDF3FA] text-[24px]">
            🔧
          </span>

          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#4771A6]">
              Step 1 of 3
            </p>

            <h2 className="text-[21px] font-extrabold text-[#101828]">
              Choose your service
            </h2>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-[13px] font-bold text-[#344054]">
            What does your vehicle need?
          </span>

          <select
            value={serviceId}
            onChange={(event) =>
              setServiceId(
                event.target.value
              )
            }
            className="w-full rounded-[13px] border border-[#98A2B3] bg-white px-4 py-4 text-[16px] font-bold text-[#101828] focus:border-[#4771A6]"
          >
            {services.map((service) => (
              <option
                key={service.id}
                value={service.id}
              >
                {service.name} ·{" "}
                {formatPriceCents(
                  service.price_cents
                )}{" "}
                ·{" "}
                {service.duration_minutes}{" "}
                min
              </option>
            ))}
          </select>
        </label>

        {selectedService && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[15px] bg-[#F4F8FC] px-5 py-4">
            <div>
              <p className="text-[13px] font-semibold text-[#667085]">
                Fixed service price
              </p>

              <p className="text-[25px] font-extrabold text-[#101828]">
                {formatPriceCents(
                  selectedService.price_cents
                )}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[13px] font-semibold text-[#667085]">
                Time reserved
              </p>

              <p className="text-[20px] font-extrabold text-[#344054]">
                {selectedService.duration_minutes}{" "}
                minutes
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ================================================
          STEP 2: DATE AND AVAILABILITY
      ================================================ */}

      <section className="rounded-[24px] border border-[#BAC7D7] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EDF3FA] text-[24px]">
            📅
          </span>

          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#4771A6]">
              Step 2 of 3
            </p>

            <h2 className="text-[21px] font-extrabold text-[#101828]">
              Pick an available time
            </h2>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="min-w-[190px] flex-1">
            <span className="mb-2 block text-[13px] font-bold text-[#344054]">
              Appointment date · Montreal
              time
            </span>

            <input
              type="date"
              value={day}
              min={today}
              max={maxDay}
              onChange={(event) =>
                setDay(
                  event.target.value
                )
              }
              className="h-[52px] w-full rounded-[13px] border border-[#98A2B3] bg-white px-4 text-[15px] font-bold text-[#101828]"
            />
          </label>

          <button
            type="button"
            onClick={() =>
              setDay(today)
            }
            className="h-[52px] rounded-[13px] border border-[#98A2B3] bg-[#EDF3FA] px-5 text-[14px] font-bold text-[#315C91] hover:bg-[#DFEAF7]"
          >
            ⚡ ASAP / Today
          </button>
        </div>

        <p className="mt-2 text-[12px] text-[#667085]">
          Book up to six months ahead.
          Available starts update from the
          garage calendar, including walk-ins
          and blocked periods.
        </p>

        {/* PUBLIC NOTE DISPLAY */}

        {!loading &&
          publicNotes.length > 0 && (
            <div
              role="status"
              className="mt-5 rounded-[15px] border border-[#F5C36A] bg-[#FFF7E9] p-4 text-left"
            >
              <p className="text-[14px] font-extrabold text-[#92400E]">
                📣 Message from the garage for
                this date
              </p>

              {publicNotes.map(
                (item, index) => (
                  <p
                    key={`${item.starts_at}-${index}`}
                    className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[#78350F]"
                  >
                    {item.public_note}
                  </p>
                )
              )}
            </div>
          )}

        {!hoursConfigured && (
          <p className="mt-5 rounded-[15px] border border-[#FEC84B] bg-[#FFFAEB] p-4 text-[14px] text-[#92400E]">
            This garage has not published its
            business hours yet. You can
            contact them directly while they
            set up their calendar.
          </p>
        )}

        <div className="mt-6 space-y-5">
          {loading && (
            <p
              role="status"
              className="rounded-[15px] bg-[#F2F4F7] p-5 text-center font-semibold text-[#667085]"
            >
              Checking live availability…
            </p>
          )}

          {!loading &&
            hoursConfigured &&
            slots.length === 0 && (
              <div className="rounded-[15px] border border-[#D5DFEA] bg-[#F8FAFC] p-5 text-center">
                <p className="font-bold text-[#101828]">
                  No free slots on this date.
                </p>

                <p className="mt-1 text-[13px] text-[#667085]">
                  {publicNotes.length
                    ? "See the garage's explanation above, or choose another date."
                    : "Try another day — existing bookings and blocked time are automatically excluded."}
                </p>

                {day < maxDay && (
                  <button
                    type="button"
                    onClick={nextDay}
                    className="mt-3 rounded-xl bg-[#4771A6] px-4 py-2.5 text-[13px] font-bold text-white"
                  >
                    Try next day →
                  </button>
                )}
              </div>
            )}

          {!loading &&
            [
              {
                label: "Morning",
                values: morning,
              },
              {
                label: "Afternoon",
                values: afternoon,
              },
              {
                label: "Evening & night",
                values: evening,
              },
            ]
              .filter(
                (group) =>
                  group.values.length >
                  0
              )
              .map((group) => (
                <div key={group.label}>
                  <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#667085]">
                    {group.label}
                  </h3>

                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {group.values.map(
                      (item) => (
                        <button
                          type="button"
                          key={
                            item.slot_time
                          }
                          aria-pressed={
                            slot ===
                            item.slot_time
                          }
                          onClick={() =>
                            setSlot(
                              item.slot_time
                            )
                          }
                          className={`rounded-[12px] border px-3 py-3 text-[13px] font-bold transition ${
                            slot ===
                            item.slot_time
                              ? "border-[#4771A6] bg-[#4771A6] text-white"
                              : "border-[#D0D5DD] bg-white text-[#344054] hover:border-[#4771A6] hover:bg-[#EDF3FA]"
                          }`}
                        >
                          {formatHour(
                            item.slot_time
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
        </div>
      </section>

      {/* ================================================
          STEP 3: CONFIRM BOOKING
      ================================================ */}

      <section className="rounded-[24px] border border-[#BAC7D7] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EDF3FA] text-[24px]">
            ✓
          </span>

          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#4771A6]">
              Step 3 of 3
            </p>

            <h2 className="text-[21px] font-extrabold text-[#101828]">
              Confirm your appointment
            </h2>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-[13px] font-bold text-[#344054]">
            Your vehicle (optional · prefilled
            from MECATREX)
          </span>

          <input
            type="text"
            maxLength={120}
            value={vehicle}
            onChange={(event) =>
              setVehicle(
                event.target.value
              )
            }
            placeholder="e.g. 2020 Honda Civic"
            className="w-full rounded-[13px] border border-[#98A2B3] px-4 py-3 text-[14px] outline-none focus:border-[#4771A6]"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-2 block text-[13px] font-bold text-[#344054]">
            Notes for the garage (optional)
          </span>

          <textarea
            rows={3}
            maxLength={500}
            value={note}
            onChange={(event) =>
              setNote(
                event.target.value
              )
            }
            placeholder="Vehicle details, symptoms, anything helpful…"
            className="w-full rounded-[13px] border border-[#98A2B3] px-4 py-3 text-[14px] outline-none focus:border-[#4771A6]"
          />
        </label>

        <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-[#F2F4F7] p-4 text-[13px] leading-6 text-[#475467]">
          <span aria-hidden="true">
            🚙
          </span>

          <p>
            <strong>
              Towing needed?
            </strong>{" "}
            Towing bookings are coming in
            the next phase. This request is
            for garage service only.
          </p>
        </div>

        <div className="mt-4 rounded-[14px] bg-[#ECFDF3] p-4 text-[13px] text-[#05603A]">
          No online payment today. Your
          fixed service price will be paid
          at the garage; Stripe will be
          added later.
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-[14px] bg-[#FEF3F2] p-4 text-[13px] font-semibold text-[#B42318]"
          >
            {error}
          </div>
        )}

        {!canConfirm ? (
          <div className="mt-5 space-y-3">
            <p className="text-[14px] font-semibold text-[#344054]">
              Log in or create a client
              account to confirm this
              appointment.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/login?next=${encodeURIComponent(
                  nextPath
                )}`}
                className="rounded-[13px] bg-[#4771A6] px-6 py-3.5 text-[14px] font-bold text-white"
              >
                Log in to book →
              </Link>

              <Link
                href={`/signup?next=${encodeURIComponent(
                  nextPath
                )}`}
                className="rounded-[13px] border border-[#BAC7D7] px-6 py-3.5 text-[14px] font-bold text-[#315C91]"
              >
                Create client account
              </Link>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={
              booking ||
              !slot ||
              loading
            }
            onClick={submit}
            className="mt-5 w-full rounded-[15px] bg-[#4771A6] px-6 py-4 text-[17px] font-extrabold text-white shadow-[0_8px_20px_rgba(71,113,166,0.17)] hover:bg-[#315C91] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {booking
              ? "Confirming your booking…"
              : !slot
                ? "Choose a time to continue"
                : "Confirm booking · Pay at garage"}
          </button>
        )}
      </section>
    </div>
  );
}
