"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMontrealDateTime, type GarageBooking } from "@/lib/booking";
import {
  revealGarageHandoffCode,
  confirmVehicleDropoff,
  markVisitServiceReady,
  emailClientVehicleReady,
  confirmClientVehiclePickup,
} from "@/app/visits/actions";

const PHOTO_BUCKET = "mecatrex-handoff-photos";
const MAX_PHOTOS = 6;
const MAX_BYTES = 5 * 1024 * 1024;

type Visit = {
  booking_id: string;
  garage_received_at: string | null;
  vehicle_ready_at: string | null;
  ready_email_sent_at: string | null;
  client_picked_up_at: string | null;
  pickup_not_received_at: string | null;
};
type Photo = { name: string; url: string };
type Props = { booking: GarageBooking; mode: "client" | "garage" };

export default function VehicleVisitCard({ booking, mode }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [enteredCode, setEnteredCode] = useState("");
  const [confirmedDropoff, setConfirmedDropoff] = useState(false);
  const [secretVisible, setSecretVisible] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async (includePhotos = true) => {
    const { data, error: queryError } = await supabase
      .from("booking_visits").select("*").eq("booking_id", booking.id).maybeSingle();
    if (queryError) {
      setError("Vehicle handoff is not ready in Supabase: " + queryError.message);
    } else {
      setVisit((data as Visit | null) ?? null);
      const dir = `${booking.id}/${booking.client_id}`;
      const listing = includePhotos
        ? await supabase.storage.from(PHOTO_BUCKET).list(dir, { limit: 30 })
        : { data: null, error: null };
      if (!listing.error && listing.data) {
        const photosWithLinks = await Promise.all(
          listing.data.filter((item) => item.name && !item.name.startsWith("."))
            .map(async (item) => {
              const { data: link } = await supabase.storage.from(PHOTO_BUCKET)
                .createSignedUrl(`${dir}/${item.name}`, 3600);
              return link?.signedUrl ? { name: item.name, url: link.signedUrl } : null;
            })
        );
        setPhotos(photosWithLinks.filter((item): item is Photo => item !== null));
      }
    }
    setLoading(false);
  }, [supabase, booking.id, booking.client_id]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refresh(false);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const canCheckIn = now >= new Date(booking.starts_at).getTime() - 2 * 60 * 60_000;
  const checkedIn = Boolean(visit?.garage_received_at);
  const ready = Boolean(visit?.vehicle_ready_at);
  const pickedUp = Boolean(visit?.client_picked_up_at);
  const photoWindowOpen = Boolean(
    checkedIn && !ready && visit?.garage_received_at &&
    now <= new Date(visit.garage_received_at).getTime() + 60 * 60_000
  );
  const phone = booking.client_phone?.replace(/[^\d+]/g, "") || "";
  const stage = pickedUp ? "Visit closed · Vehicle picked up"
    : ready ? "Service completed · Ready for pickup"
    : checkedIn ? "Vehicle received at garage"
    : "Awaiting vehicle drop-off";

  async function perform(action: () => Promise<{ ok: boolean; message: string; code?: string }>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await action();
      if (!result.ok) setError(result.message);
      else {
        setNotice(result.message);
        if (result.code) setSecretVisible(result.code);
        await refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the visit. Please retry.");
    } finally { setBusy(false); }
  }

  async function uploadPhotos() {
    if (!photoWindowOpen || mode !== "client") {
      setError("Drop-off evidence can only be uploaded during the first hour after handoff, before the service is completed.");
      return;
    }
    if (files.length === 0 || files.length + photos.length > MAX_PHOTOS) {
      setError("Choose up to six photos in total."); return;
    }
    if (files.some((file) => file.size > MAX_BYTES
      || !["image/jpeg","image/png","image/webp"].includes(file.type))) {
      setError("Use JPG, PNG or WebP images smaller than 5 MB each."); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || auth.user.id !== booking.client_id) throw new Error("Client login required.");
      for (const file of files) {
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const target = `${booking.id}/${booking.client_id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploaded } = await supabase.storage.from(PHOTO_BUCKET)
          .upload(target, file, { contentType: file.type, upsert: false });
        if (uploaded) throw new Error(uploaded.message);
      }
      setFiles([]);
      setNotice("Optional vehicle photos uploaded privately to this appointment.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Photo upload failed.");
    } finally { setBusy(false); }
  }

  if (loading) return <p className="mt-3 text-[12px] text-[#667085]">Loading vehicle handoff…</p>;

  return (
    <section className="mt-4 rounded-[16px] border border-[#BDD0E4] bg-[#F8FAFC] p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#4771A6]">🚗 Vehicle handoff and pickup</p>
      <p className="mt-2 text-[14px] font-extrabold text-[#101828]">{stage}</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-[#FEF3F2] p-3 text-[12px] font-semibold text-[#B42318]">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg bg-[#ECFDF3] p-3 text-[12px] font-semibold text-[#027A48]">{notice}</p>}

      {!checkedIn && !canCheckIn && (
        <p className="mt-3 text-[12px] leading-5 text-[#667085]">
          The handoff window opens two hours before this appointment, on {formatMontrealDateTime(new Date(new Date(booking.starts_at).getTime() - 2 * 60 * 60_000))}.
        </p>
      )}

      {!checkedIn && canCheckIn && mode === "garage" && (
        <div className="mt-3 rounded-[13px] border border-[#D5DFE9] bg-white p-3">
          <p className="text-[12px] font-bold text-[#344054]">Garage handoff code</p>
          <p className="mt-1 text-[11px] text-[#667085]">
            After physically receiving the vehicle, show or tell this unique code to the client.
            Their entry records the garage-approved handoff. Do not share it in advance.
          </p>
          <button type="button" disabled={busy} onClick={() => void perform(() => revealGarageHandoffCode(booking.id))}
            className="mt-3 rounded-xl bg-[#14263A] px-4 py-2.5 text-[12px] font-extrabold text-white disabled:opacity-50">
            {secretVisible ? "Show handoff code again" : "Reveal handoff code"}
          </button>
          {secretVisible && <p className="mt-3 select-all rounded-lg bg-[#EDF3FA] p-3 text-center font-mono text-[22px] font-extrabold tracking-[0.22em] text-[#14263A]">
            {secretVisible}
          </p>}
        </div>
      )}

      {!checkedIn && canCheckIn && mode === "client" && (
        <div className="mt-3 space-y-3 rounded-[13px] border border-[#D5DFE9] bg-white p-3">
          <p className="text-[12px] font-bold text-[#344054]">Have you dropped off your vehicle?</p>
          <p className="text-[11px] leading-5 text-[#667085]">
            Ask the garage to share its unique handoff code only after receiving the car.
            This confirms a garage-authorized handoff; it is not a GPS location check.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirmedDropoff(true)} aria-pressed={confirmedDropoff}
              className={`rounded-lg border px-4 py-2 text-[12px] font-bold ${confirmedDropoff ? "border-[#4771A6] bg-[#EDF3FA]" : "border-[#CAD6E3] bg-white"}`}>
              Yes, I dropped off the car
            </button>
            <button type="button" onClick={() => { setConfirmedDropoff(false); setEnteredCode(""); }}
              aria-pressed={!confirmedDropoff}
              className="rounded-lg border border-[#CAD6E3] bg-white px-4 py-2 text-[12px] font-bold">
              No, not yet
            </button>
          </div>
          {confirmedDropoff && <>
            <label className="block text-[12px] font-bold text-[#344054]">
              Code from the garage
              <input type="text" value={enteredCode} maxLength={8}
                onChange={(event) => setEnteredCode(event.target.value.toUpperCase().replace(/[^0-9A-F]/g, ""))}
                autoComplete="off" placeholder="8-character code"
                className="mt-2 w-full rounded-lg border border-[#98A2B3] px-3 py-3 font-mono tracking-wider" />
            </label>
            <button type="button" disabled={busy || enteredCode.length !== 8}
              onClick={() => void perform(() => confirmVehicleDropoff(booking.id, enteredCode))}
              className="rounded-xl bg-[#4771A6] px-4 py-3 text-[12px] font-extrabold text-white disabled:opacity-50">
              Confirm garage handoff
            </button>
          </>}
        </div>
      )}

      {checkedIn && !ready && (
        <div className="mt-3 rounded-xl border border-[#A6E0C0] bg-[#ECFDF3] p-3 text-[12px] text-[#05603A]">
          ✓ Vehicle drop-off recorded with the garage-issued code. This records the handoff only; it does not determine legal responsibility for damage.
          {mode === "garage" && (
            <div className="mt-3">
              <p className="mb-2 font-semibold">Is the maintenance or repair completed?</p>
              <button type="button" disabled={busy} onClick={() => {
                if (window.confirm("Confirm the vehicle service is completed and ready for customer pickup?")) {
                  void perform(() => markVisitServiceReady(booking.id));
                }
              }} className="rounded-xl bg-[#05603A] px-4 py-2.5 font-extrabold text-white disabled:opacity-50">
                ✓ Mark service completed
              </button>
            </div>
          )}
        </div>
      )}

      {ready && !pickedUp && (
        <div className="mt-3 rounded-xl border border-[#B3DAC8] bg-[#ECFDF3] p-3 text-[12px] text-[#05603A]">
          <p className="font-extrabold">✓ Vehicle is ready for pickup</p>
          {mode === "garage" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy || Boolean(visit?.ready_email_sent_at)}
                onClick={() => void perform(() => emailClientVehicleReady(booking.id))}
                className="rounded-xl bg-[#4771A6] px-4 py-2.5 font-extrabold text-white disabled:opacity-50">
                {visit?.ready_email_sent_at ? "✓ Pickup email sent" : "✉️ Email client · car ready"}
              </button>
              {phone && <a href={`tel:${phone}`} className="rounded-xl border border-[#A6E0C0] bg-white px-4 py-2.5 font-extrabold text-[#05603A]">
                📞 Call client
              </a>}
            </div>
          ) : (
            <div className="mt-3">
              <p className="mb-3">Have you collected your vehicle from the garage?</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy}
                  onClick={() => {
                    if (window.confirm("Confirm that you personally received your vehicle? This will close the visit.")) {
                      void perform(() => confirmClientVehiclePickup(booking.id, true));
                    }
                  }}
                  className="rounded-xl bg-[#05603A] px-4 py-2.5 font-extrabold text-white disabled:opacity-50">
                  ✓ Yes, I got the car
                </button>
                <button type="button" disabled={busy || Boolean(visit?.pickup_not_received_at)}
                  onClick={() => void perform(() => confirmClientVehiclePickup(booking.id, false))}
                  className="rounded-xl border border-[#C6D3E1] bg-white px-4 py-2.5 font-bold text-[#344054] disabled:opacity-50">
                  {visit?.pickup_not_received_at ? "Garage notified" : "No, I haven't received it"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "garage" && Boolean(visit?.pickup_not_received_at) && !pickedUp && (
        <p role="status" className="mt-3 rounded-xl border border-[#FDA29B] bg-[#FEF3F2] p-3 text-[12px] font-bold text-[#B42318]">
          ⚠️ The customer reported that they have not collected the car. Contact them before closing the visit.
        </p>
      )}
      {pickedUp && <p className="mt-3 rounded-xl bg-[#ECFDF3] p-3 text-[12px] font-extrabold text-[#05603A]">
        ✓ Client confirmed pickup. Vehicle visit closed.
      </p>}

      {checkedIn && (
        <div className="mt-4">
          <p className="text-[12px] font-bold text-[#344054]">Optional photo evidence</p>
          <p className="mt-1 text-[11px] leading-5 text-[#667085]">
            Photos can document the condition of the vehicle and the garage storefront at drop-off.
            MECATREX does not verify where an image was taken, provide insurance or handle damage claims.
            Add photos within one hour after the handoff code is accepted, before the garage marks the service complete.
          </p>
          {mode === "client" && photoWindowOpen && photos.length < MAX_PHOTOS && (
            <div className="mt-3">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple
                onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
                aria-label="Select optional photos of the car and garage storefront"
                className="block max-w-full text-[12px] text-[#475467]" />
              <button type="button" disabled={busy || files.length === 0}
                onClick={() => void uploadPhotos()}
                className="mt-3 rounded-lg border border-[#A8C2DF] bg-white px-4 py-2.5 text-[12px] font-bold text-[#315C91] disabled:opacity-50">
                Upload {files.length || ""} photos (max 6, 5 MB each)
              </button>
            </div>
          )}
          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((photo,i) =>
                <a key={photo.name} href={photo.url} target="_blank" rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-[#D5DFE9] bg-white"
                  aria-label={`View handoff photo ${i+1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`Vehicle handoff evidence ${i+1}`}
                    className="h-24 w-full object-cover" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
