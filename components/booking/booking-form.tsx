
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createGarageBooking } from "@/app/book/actions";
import { VEHICLE_YEARS, VEHICLE_MAKES, VEHICLE_MODELS_BY_MAKE, VEHICLE_COLORS } from "@/lib/vehicle-options";
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
  initialServices?: string[];
  canConfirm: boolean;
  bookingSuspended?: boolean;
};

export default function BookingForm({
  providerId,
  services,
  hours,
  initialService,
  initialServices,
  canConfirm,
  bookingSuspended = false,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [today, setToday] = useState(
    () => montrealDate()
  );

  const [serviceIds, setServiceIds] = useState<string[]>(() => {
    const fromUrl = [...new Set((initialServices ?? []).filter((id) =>
      services.some((service) => service.id === id)
    ))];
    if (fromUrl.length > 0) return fromUrl;
    const first = initialService && services.some((service) => service.id === initialService)
      ? initialService : services[0]?.id;
    return first ? [first] : [];
  });
  const serviceId = serviceIds[0] ?? "";
  const selectedServices = serviceIds
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is Service => Boolean(service));
  const totalPriceCents = selectedServices.reduce((total, service) => total + service.price_cents, 0);
  const totalDurationMinutes = selectedServices.reduce((total, service) => total + service.duration_minutes, 0);

  function toggleService(id: string) {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id]
    );
  }

  const [day, setDay] = useState(today);
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [publicNotes, setPublicNotes] =
    useState<PublicBlockNote[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [booking, setBooking] =
    useState(false);
  const [completedBooking, setCompletedBooking] = useState<{
    id: string;
    day: string;
    time: string;
    serviceNames: string[];
    priceCents: number;
    durationMinutes: number;
    towingPending: boolean;
  } | null>(null);

  const [error, setError] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityDebug, setAvailabilityDebug] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [wantsTowing, setWantsTowing] = useState<boolean | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [towingNote, setTowingNote] = useState("");
  const [stepError, setStepError] = useState("");

  const vehicleDescription = [
    vehicleYear, vehicleMake, vehicleModel, vehicleColor,
  ].filter(Boolean).join(" ").slice(0, 120);
  const partialVehicle = Boolean(vehicleYear || vehicleMake || vehicleModel || vehicleColor);
  const validVehicle = !partialVehicle || Boolean(vehicleYear && vehicleMake && vehicleModel);

  const [
    preferredTime,
    setPreferredTime,
  ] = useState("");

  const selectedService = selectedServices[0];

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

        if (description && parsed.year && parsed.make && parsed.model) {
          setVehicleYear(String(parsed.year));
          setVehicleMake(String(parsed.make));
          setVehicleModel(String(parsed.model));
          setVehicleColor(typeof parsed.color === "string" ? parsed.color : "");
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
      setAvailabilityError("");
      setAvailabilityDebug("");
      return;
    }

    let active = true;

    setLoading(true);
    setAvailabilityError("");
    setAvailabilityDebug("");
    setSlot("");
    setPublicNotes([]);

    async function load() {
      const [
        slotsResult,
        notesResult,
      ] = await Promise.all([
        serviceIds.length === 1
          ? supabase.rpc("garage_available_slots", {
              p_provider_id: providerId,
              p_service_id: serviceIds[0],
              p_day: day,
            })
          : supabase.rpc("garage_available_slots_multi", {
              p_provider_id: providerId,
              p_service_ids: serviceIds,
              p_day: day,
            }),

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
        const isMulti = serviceIds.length > 1;
        const technicalMessage = slotsResult.error.message || "Database availability request failed.";
        const migrationMissing = slotsResult.error.code === "PGRST202" ||
          slotsResult.error.code === "42883";
        setAvailabilityError(
          migrationMissing && isMulti
            ? "Multi-service availability is not installed in Supabase. Apply the z04 availability migration after z01–z03."
            : isMulti
              ? "Could not calculate availability for the combined services. The database returned an error; the calendar has NOT been checked."
              : "Could not load the garage availability. The database returned an error; the calendar has NOT been checked."
        );
        setAvailabilityDebug(
          `Database error ${slotsResult.error.code ?? "unknown"}: ${technicalMessage}`
        );
        console.error("MECATREX availability request failed", slotsResult.error);
      } else {
        const available = (
          slotsResult.data ?? []
        ) as Slot[];

        setAvailabilityError("");
        setAvailabilityDebug("");
        setSlots(available);

        // Diagnose an unexpectedly empty multi-service result against the
        // original, working one-service schedule. Never fabricate bookable
        // slots: only the database may authorize a multi-service reservation.
        if (available.length === 0 && serviceIds.length > 1) {
          const { data: original, error: originalError } = await supabase.rpc(
            "garage_available_slots",
            { p_provider_id: providerId, p_service_id: serviceIds[0], p_day: day }
          );
          if (!active) return;
          if (!originalError && original?.length) {
            const singleSlots = original as Slot[];
            const startTimes = new Set(singleSlots.map((item) => Date.parse(item.starts_at)));
            const extraMinutes = Math.max(
              0,
              totalDurationMinutes - (selectedServices[0]?.duration_minutes ?? 0)
            );
            const additionalStarts = Math.ceil(extraMinutes / 30);
            const contiguousStarts = singleSlots.filter((base) => {
              const firstStart = Date.parse(base.starts_at);
              return Array.from(
                { length: additionalStarts + 1 },
                (_, index) => firstStart + index * 30 * 60_000
              ).every((timestamp) => startTimes.has(timestamp));
            });
            if (contiguousStarts.length > 0) {
              setAvailabilityError(
                "The garage has consecutive free times for these services, but the multi-service database function returned no slots. This appears to be a database availability mismatch, not a full garage schedule. Check that the z04 SQL hotfix was applied in Supabase."
              );
              setAvailabilityDebug(
                `Single-service starts: ${singleSlots.length}; consecutive ${totalDurationMinutes}-minute candidates: ${contiguousStarts.length}; multi-service starts: 0.`
              );
            }
          }
        }

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
    serviceIds,
    day,
    today,
    maxDay,
    preferredTime,
    totalDurationMinutes,
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
      completedBooking ||
      !canConfirm ||
      !validVehicle ||
      wantsTowing === null ||
      (wantsTowing && pickupAddress.trim().length < 8)
    ) {
      return;
    }

    setBooking(true);
    setError("");
    setStepError("");

    const form = new FormData();
    form.set("provider_id", providerId);
    form.set("service_ids", JSON.stringify(serviceIds));
    form.set("day", day);
    form.set("time", slot);
    form.set("note", note);
    form.set("vehicle", vehicleDescription);
    form.set("wants_towing", wantsTowing ? "yes" : "no");
    form.set("pickup_address", wantsTowing ? pickupAddress.trim() : "");
    form.set("towing_note", wantsTowing ? towingNote.trim() : "");

    try {
      const result = await createGarageBooking(form);
      if (!result.ok) {
        // Never navigate away from the confirmation step when a write fails.
        // Previously the UI jumped back to step 2 and hid the error inside
        // the now-hidden step 4, making failed bookings look successful.
        setError(result.error || "The booking was not saved. Please try again.");
        return;
      }

      // A success screen is shown only after the database RPC returned
      // a committed booking identifier; clicking the button is not enough.
      setCompletedBooking({
        id: result.bookingId,
        day,
        time: slot,
        serviceNames: selectedServices.map((service) => service.name),
        priceCents: totalPriceCents,
        durationMinutes: totalDurationMinutes,
        towingPending: wantsTowing,
      });
    } catch (submissionError) {
      console.error("MECATREX booking submission failed:", submissionError);
      setError(
        "Could not verify your reservation because of a connection or server error. " +
        "Please check My appointments before retrying to avoid a duplicate booking."
      );
    } finally {
      setBooking(false);
    }
  }

  const nextPath =
    `/book/${providerId}?service=${encodeURIComponent(serviceId)}&services=${encodeURIComponent(serviceIds.join(","))}`;

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

  const steps = [
    { number: 1, name: "Service", icon: "🔧" },
    { number: 2, name: "Date & time", icon: "📅" },
    { number: 3, name: "Details", icon: "🚘" },
    { number: 4, name: "Towing & confirm", icon: "🚛" },
  ] as const;

  function goForward() {
    setStepError("");
    if (step === 1 && selectedServices.length === 0) {
      setStepError("Please select a service first.");
      return;
    }
    if (step === 2 && (availabilityError || !slot || loading)) {
      setStepError(availabilityError || "Choose an available date and time before continuing.");
      return;
    }
    if (step === 3 && !validVehicle) {
      setStepError("Complete the year, make and model, or leave all vehicle fields empty.");
      return;
    }
    setStep((current) => Math.min(4, current + 1) as 1 | 2 | 3 | 4);
  }

  function goBack() {
    setStepError("");
    setError("");
    setStep((current) => Math.max(1, current - 1) as 1 | 2 | 3 | 4);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[23px] border border-[#C5D5E9] bg-white px-4 py-5 shadow-sm sm:px-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">
          One step at a time
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Booking progress">
          {steps.map((item) => {
            const active = step === item.number;
            const done = step > item.number;
            return (
              <button key={item.number} type="button"
                disabled={item.number > step}
                onClick={() => {
                  setStep(item.number);
                  setStepError("");
                }}
                aria-current={active ? "step" : undefined}
                className={"flex flex-col items-center gap-1 rounded-[14px] px-1 py-3 text-center transition sm:flex-row sm:justify-center sm:gap-2 " +
                  (active ? "bg-[#4771A6] text-white shadow-sm" :
                    done ? "bg-[#EDF7F2] text-[#027A48] hover:bg-[#DEF2E7]" :
                    "bg-[#F3F6FA] text-[#98A2B3]")}
              >
                <span className="text-[15px]" aria-hidden="true">{done ? "✓" : item.icon}</span>
                <span className="text-[10px] font-extrabold sm:text-[12px]">{item.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[12px] text-[#667085]">
          Step {step} of 4 · {steps[step - 1].name}
        </p>
      </div>

      {/* ================================================
          STEP 1: SERVICE
      ================================================ */}

      <section hidden={step !== 1} className="rounded-[24px] border border-[#BAC7D7] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EDF3FA] text-[24px]">
            🔧
          </span>

          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#4771A6]">
              Step 1 of 4
            </p>

            <h2 className="text-[21px] font-extrabold text-[#101828]">
              Choose your service
            </h2>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-[13px] font-bold text-[#344054]">
            Select all services you need. Each service adds its fixed price and time to this visit.
          </p>
          <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-[14px] border border-[#D5DFEA] bg-[#F8FAFC] p-2">
            {services.map((service) => {
              const checked = serviceIds.includes(service.id);
              return (
                <label key={service.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition ${checked ? "border-[#4771A6] bg-[#EDF3FA]" : "border-transparent bg-white hover:border-[#CAD8E8]"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleService(service.id)}
                    className="h-5 w-5 shrink-0 accent-[#4771A6]" aria-label={`Add ${service.name}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-extrabold text-[#101828]">{service.name}</p>
                    <p className="mt-1 text-[11px] text-[#667085]">{service.duration_minutes} min{service.description ? ` · ${service.description}` : ""}</p>
                  </div>
                  <span className="shrink-0 text-[13px] font-extrabold text-[#315C91]">{formatPriceCents(service.price_cents)}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-4 rounded-[16px] border border-[#BDD0E4] bg-[#EDF3FA] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-extrabold text-[#101828]">
                {selectedServices.length} selected {selectedServices.length === 1 ? "service" : "services"}
              </p>
              {selectedServices.length > 1 && (
                <button type="button" onClick={() => setServiceIds([])}
                  className="text-[12px] font-bold text-[#315C91] underline">Clear selection</button>
              )}
            </div>
            <div className="space-y-1">
              {selectedServices.map((service) => (
                <div key={service.id} className="flex justify-between gap-3 text-[12px] text-[#344054]">
                  <span>✓ {service.name}</span>
                  <span className="font-bold">{formatPriceCents(service.price_cents)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-3 border-t border-[#BDD0E4] pt-3">
              <div><p className="text-[11px] text-[#667085]">Total fixed price</p>
                <p className="text-[23px] font-extrabold text-[#101828]">{formatPriceCents(totalPriceCents)}</p></div>
              <div className="text-right"><p className="text-[11px] text-[#667085]">Total time reserved</p>
                <p className="text-[20px] font-extrabold text-[#344054]">{totalDurationMinutes} min</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================
          STEP 2: DATE AND AVAILABILITY
      ================================================ */}

      <section hidden={step !== 2} className="rounded-[24px] border border-[#BAC7D7] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EDF3FA] text-[24px]">
            📅
          </span>

          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#4771A6]">
              Step 2 of 4
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

        {availabilityError && (
          <div role="alert" className="mt-5 rounded-[15px] border border-[#FDA29B] bg-[#FEF3F2] p-4 text-[13px] text-[#B42318]">
            <p className="font-extrabold">⚠️ Availability could not be checked</p>
            <p className="mt-2 leading-5">{availabilityError}</p>
            {availabilityDebug && (
              <p className="mt-2 break-words rounded-lg bg-white/70 p-2 font-mono text-[11px]">{availabilityDebug}</p>
            )}
          </div>
        )}

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
            !availabilityError &&
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

      <section hidden={step !== 3} className="rounded-[24px] border border-[#BAC7D7] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EDF3FA] text-[24px]">
            ✓
          </span>

          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#4771A6]">
              Step 3 of 4
            </p>

            <h2 className="text-[21px] font-extrabold text-[#101828]">
              Your appointment details
            </h2>
          </div>
        </div>


        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-bold text-[#344054]">Your vehicle <span className="font-normal text-[#667085]">(optional)</span></p>
            {vehicleDescription && <p className="text-[12px] font-bold text-[#315C91]">{vehicleDescription}</p>}
          </div>
          <p className="mt-1 text-[12px] text-[#667085]">
            Saved MECATREX vehicle details appear automatically. If you do not know the details, leave all fields blank.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-[12px] font-bold text-[#344054]">
              Year
              <select value={vehicleYear} onChange={(event) => setVehicleYear(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#BAC7D7] bg-white px-3 py-3 text-[14px] text-[#101828]">
                <option value="">Select year</option>
                {VEHICLE_YEARS.map((year) => <option value={year} key={year}>{year}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-bold text-[#344054]">
              Make
              <select value={vehicleMake} onChange={(event) => {
                setVehicleMake(event.target.value);
                setVehicleModel("");
              }} className="mt-1.5 w-full rounded-xl border border-[#BAC7D7] bg-white px-3 py-3 text-[14px] text-[#101828]">
                <option value="">Select make</option>
                {VEHICLE_MAKES.map((make) => <option value={make} key={make}>{make}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-bold text-[#344054]">
              Model
              <select value={vehicleModel} disabled={!vehicleMake} onChange={(event) => setVehicleModel(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#BAC7D7] bg-white px-3 py-3 text-[14px] text-[#101828] disabled:bg-[#F3F6FA]">
                <option value="">{vehicleMake ? "Select model" : "Select a make first"}</option>
                {(VEHICLE_MODELS_BY_MAKE[vehicleMake] ?? []).map((model) => <option value={model} key={model}>{model}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-bold text-[#344054]">
              Colour <span className="font-normal text-[#667085]">(optional)</span>
              <select value={vehicleColor} onChange={(event) => setVehicleColor(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#BAC7D7] bg-white px-3 py-3 text-[14px] text-[#101828]">
                <option value="">Select colour</option>
                {VEHICLE_COLORS.map((color) => <option value={color} key={color}>{color}</option>)}
              </select>
            </label>
          </div>
          {!validVehicle && <p role="alert" className="mt-2 text-[12px] font-semibold text-[#B42318]">
            If you enter a vehicle, please complete its year, make and model. Otherwise, leave the fields empty.
          </p>}
        </div>
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


      </section>

      <section hidden={step !== 4} className="rounded-[24px] border border-[#BAC7D7] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EDF3FA] text-[24px]">🚛</span>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#4771A6]">Step 4 of 4</p>
            <h2 className="text-[21px] font-extrabold text-[#101828]">Do you need towing?</h2>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-6 text-[#667085]">
          If you drive yourself, your garage appointment is confirmed immediately. If you request towing, the garage time is reserved but the full booking stays pending until a towing company accepts.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {([{ value: false, label: "No, I'll drive", icon: "🚗" }, { value: true, label: "Yes, request towing", icon: "🚛" }] as const).map((option) => (
            <button type="button" key={option.label}
              onClick={() => { setWantsTowing(option.value); setStepError(""); }}
              aria-pressed={wantsTowing === option.value}
              className={"rounded-[15px] border p-4 text-left text-[13px] font-bold transition " +
                (wantsTowing === option.value ? "border-[#4771A6] bg-[#EDF3FA] text-[#244F83]" : "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F8FAFC]")}
            >
              <span className="block text-[23px]" aria-hidden="true">{option.icon}</span>
              <span className="mt-2 block">{option.label}</span>
            </button>
          ))}
        </div>
        {wantsTowing && (
          <div className="mt-5 space-y-4 rounded-[16px] border border-[#BDD0E4] bg-[#F7FAFE] p-4">
            <label className="block text-[13px] font-bold text-[#344054]">
              Pickup address <span className="text-[#B42318]">*</span>
              <input value={pickupAddress} maxLength={240} onChange={(event) => setPickupAddress(event.target.value)}
                placeholder="Street address, city, province and postal code"
                className="mt-2 w-full rounded-xl border border-[#BAC7D7] bg-white px-4 py-3 text-[14px] outline-none focus:border-[#4771A6]"/>
            </label>
            <label className="block text-[13px] font-bold text-[#344054]">
              Extra towing information (optional)
              <textarea rows={2} value={towingNote} maxLength={500} onChange={(event) => setTowingNote(event.target.value)}
                placeholder="Is the car accessible? Flat tire, won't start, underground garage..."
                className="mt-2 w-full rounded-xl border border-[#BAC7D7] bg-white px-4 py-3 text-[14px] outline-none focus:border-[#4771A6]"/>
            </label>
            <p className="text-[12px] leading-5 text-[#52647D]">
              This is a request, not an accepted towing booking. Pickup time and towing price are not fixed yet; the provider will need to coordinate with you.
            </p>
          </div>
        )}
        <div className="mt-5 rounded-[15px] border border-[#D6E3EF] bg-[#F7FAFD] p-4 text-[13px]">
          <p className="font-bold text-[#344054]">Your booking summary</p>
          <p className="mt-2 text-[#101828]">{selectedServices.map((service) => service.name).join(" + ")} · {formatPriceCents(totalPriceCents)}</p>
          <p className="mt-1 text-[#667085]">{day} · {slot ? formatHour(slot) : "No time selected"} · {totalDurationMinutes} min</p>
          <p className="mt-1 text-[#667085]">{vehicleDescription || "Vehicle not specified"}</p>
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
            className="mt-4 rounded-[14px] border border-[#FDA29B] bg-[#FEF3F2] p-4 text-[13px] font-semibold text-[#B42318]"
          >
            <p className="text-[14px] font-extrabold">Booking not confirmed</p>
            <p className="mt-2 break-words">{error}</p>
            <p className="mt-2 text-[12px] font-normal">
              Nothing has been confirmed on this screen. Keep your selections, or choose a new time if the garage is unavailable.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={() => { setStep(2); setError(""); }}
                className="rounded-lg border border-[#FDA29B] bg-white px-3 py-2 text-[12px] font-bold text-[#B42318]">
                Change date or time
              </button>
              <Link href="/account" className="rounded-lg border border-[#FDA29B] bg-white px-3 py-2 text-[12px] font-bold text-[#B42318]">
                Check my appointments
              </Link>
            </div>
          </div>
        )}

        {!canConfirm ? bookingSuspended ? (
          <div role="alert" className="mt-5 rounded-[15px] border border-[#FDA29B] bg-[#FEF3F2] p-5 text-[13px] font-bold text-[#B42318]">
            Your MECATREX booking account is suspended after three late cancellation warnings.
            Existing bookings remain visible in your account. Contact support to request a review.
          </div>
        ) : (
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
              Boolean(completedBooking) ||
              !slot ||
              loading ||
              wantsTowing === null ||
              (wantsTowing && pickupAddress.trim().length < 8)
            }
            onClick={submit}
            className="mt-5 w-full rounded-[15px] bg-[#4771A6] px-6 py-4 text-[17px] font-extrabold text-white shadow-[0_8px_20px_rgba(71,113,166,0.17)] hover:bg-[#315C91] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {booking
              ? "Confirming your booking…"
              : !slot
                ? "Choose a time to continue"
                : wantsTowing === null
                  ? "Choose a towing option to continue"
                  : wantsTowing && pickupAddress.trim().length < 8
                    ? "Enter the towing pickup address"
                    : wantsTowing ? "Reserve garage · request towing" : "Confirm garage booking"}
          </button>
        )}
      </section>
      {stepError && <p role="alert" className="rounded-[13px] bg-[#FEF3F2] p-4 text-[13px] font-semibold text-[#B42318]">{stepError}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={goBack} disabled={step === 1 || booking}
          className="rounded-[14px] border border-[#CBD5E1] bg-white px-5 py-3.5 text-[14px] font-bold text-[#344054] disabled:opacity-40">
          ← Back
        </button>
        {step < 4 && <button type="button" onClick={goForward}
          className="rounded-[14px] bg-[#4771A6] px-7 py-3.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#315C91]">
          Continue →
        </button>}
      </div>

      {completedBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#101828]/70 px-4 py-8"
          role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="mecatrex-booking-complete-title"
            aria-describedby="mecatrex-booking-complete-description"
            className="w-full max-w-[510px] rounded-[26px] border border-[#D4E0EA] bg-white p-6 shadow-[0_32px_90px_rgba(16,24,40,0.25)] sm:p-8">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-[30px] ${
              completedBooking.towingPending
                ? "bg-[#FFFAE7] text-[#9B6D00]"
                : "bg-[#ECFDF3] text-[#027A48]"
            }`}>
              {completedBooking.towingPending ? "🚛" : "✓"}
            </div>
            <p className={`mt-5 text-center text-[11px] font-extrabold uppercase tracking-[0.15em] ${
              completedBooking.towingPending ? "text-[#946600]" : "text-[#027A48]"
            }`}>
              {completedBooking.towingPending ? "Garage reserved · towing pending" : "Reservation confirmed"}
            </p>
            <h2 id="mecatrex-booking-complete-title"
              className="mt-2 text-center text-[25px] font-extrabold tracking-tight text-[#101828]">
              {completedBooking.towingPending
                ? "Your garage time is reserved!"
                : "Your appointment is confirmed!"}
            </h2>
            <p id="mecatrex-booking-complete-description"
              className="mx-auto mt-3 max-w-[390px] text-center text-[13px] leading-6 text-[#475467]">
              {completedBooking.towingPending
                ? "We have sent your towing request to eligible companies. The complete booking will be confirmed after a towing provider accepts. Your garage time is already held."
                : "The garage received your booking. You can find this appointment in your client account."}
            </p>
            <div className="mt-6 rounded-[17px] border border-[#DCE5EE] bg-[#F8FAFC] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">Appointment summary</p>
              <div className="mt-3 space-y-2 text-[13px]">
                <p className="font-bold text-[#101828]">{completedBooking.serviceNames.join(" + ")}</p>
                <div className="flex justify-between gap-4 text-[#344054]">
                  <span>{completedBooking.day} · {formatHour(completedBooking.time)}</span>
                  <span>{completedBooking.durationMinutes} min</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-[#DCE5EE] pt-3 font-extrabold text-[#101828]">
                  <span>Garage service total</span>
                  <span>{formatPriceCents(completedBooking.priceCents)}</span>
                </div>
                {completedBooking.towingPending && (
                  <p className="text-[11px] leading-5 text-[#946600]">
                    Towing charges and pickup arrangements are separate and still need coordination.
                  </p>
                )}
                <p className="break-all text-[10px] text-[#667085]">Booking reference: {completedBooking.id}</p>
              </div>
            </div>
            <button type="button" autoFocus
              onClick={() => router.push("/account?booked=1")}
              className="mt-6 w-full rounded-[14px] bg-[#4771A6] px-5 py-3.5 text-[14px] font-extrabold text-white hover:bg-[#315C91]">
              View my appointments →
            </button>
            <button type="button" onClick={() => router.push("/")}
              className="mt-3 w-full rounded-[14px] border border-[#D5DFE9] bg-white px-5 py-3 text-[13px] font-bold text-[#475467] hover:bg-[#F8FAFC]">
              Back to garages
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
