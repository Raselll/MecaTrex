"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cancelGarageBooking, reviewGarageBooking } from "@/app/book/actions";
import { formatMontrealDateTime, formatPriceCents, type GarageBooking } from "@/lib/booking";

type Review = { booking_id: string; stars: number; comment: string };

function ReviewForm({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await reviewGarageBooking(bookingId, stars, comment);
    setPending(false);
    if (result.ok) onDone();
    else setError(result.message);
  }

  return <form onSubmit={submit} className="mt-4 rounded-[16px] border border-[#BAC7D7] bg-[#F8FAFC] p-4">
    <h4 className="text-[14px] font-extrabold text-[#101828]">⭐ How was your garage visit?</h4>
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Your star rating">
      {[1,2,3,4,5].map((rating) => <button type="button" key={rating} onClick={() => setStars(rating)}
        aria-pressed={stars === rating} aria-label={`${rating} star${rating > 1 ? "s" : ""}`}
        className={`rounded-[10px] border px-3 py-2 text-[19px] ${stars >= rating ? "border-[#F59E0B] bg-[#FFFAEB] text-[#D97706]" : "border-[#D0D5DD] bg-white text-[#98A2B3]"}`}>★</button>)}
    </div>
    <label className="mt-3 block">
      <span className="mb-2 block text-[12px] font-bold text-[#344054]">Your review (optional)</span>
      <textarea rows={2} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)}
        placeholder="What went well? What could be improved?" className="w-full rounded-[12px] border border-[#98A2B3] bg-white px-3 py-3 text-[13px]" />
    </label>
    {error && <p role="alert" className="mt-2 text-[12px] font-semibold text-[#B42318]">{error}</p>}
    <button disabled={pending} type="submit" className="mt-3 rounded-[12px] bg-[#4771A6] px-5 py-3 text-[13px] font-bold text-white disabled:opacity-50">{pending ? "Posting review…" : "Post my review"}</button>
  </form>;
}

export default function ClientBookings({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [bookings, setBookings] = useState<GarageBooking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState("");

  const refresh = useCallback(async () => {
    const [{ data: rows, error: bookingError }, { data: reviewRows }] = await Promise.all([
      supabase.from("garage_bookings").select("*")
        .eq("client_id", userId).order("starts_at", { ascending: false }).limit(150),
      supabase.from("garage_reviews").select("booking_id,stars,comment").eq("client_id", userId),
    ]);
    if (bookingError) setError(bookingError.message);
    else { setBookings((rows ?? []) as GarageBooking[]); setError(""); }
    setReviews((reviewRows ?? []) as Review[]);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const now = Date.now();
  const upcoming = bookings.filter((b) => b.status === "confirmed" && new Date(b.ends_at).getTime() > now);
  const history = bookings.filter((b) => b.status !== "confirmed" || new Date(b.ends_at).getTime() <= now);
  const visible = tab === "upcoming" ? [...upcoming].sort((a,b) => a.starts_at.localeCompare(b.starts_at)) : history;

  async function cancel(booking: GarageBooking) {
    if (!window.confirm("Cancel this confirmed appointment? The garage will be notified and the time will become available.")) return;
    setPendingId(booking.id);
    setNotice("");
    const result = await cancelGarageBooking(booking.id, "client");
    setPendingId("");
    if (!result.ok) setError(result.message);
    else { setNotice(result.message); await refresh(); }
  }

  return (
    <section id="my-bookings" className="scroll-mt-12 rounded-[25px] border border-[#D0D5DD] bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#4771A6]">Your appointments</p>
          <h2 className="mt-1 text-[25px] font-extrabold text-[#101828]">📅 My bookings</h2>
          <p className="mt-2 text-[13px] text-[#667085]">Confirmed bookings, cancellations and reviews stay synchronized with each garage calendar.</p>
        </div>
        <Link href="/#garage-results" className="rounded-[13px] bg-[#4771A6] px-5 py-3 text-[13px] font-bold text-white hover:bg-[#315C91]">+ Book a garage</Link>
      </div>
      <div className="mt-5 flex gap-2 border-b border-[#E4E7EC] pb-3">
        <button type="button" onClick={() => setTab("upcoming")} className={`rounded-xl px-4 py-2.5 text-[13px] font-bold ${tab === "upcoming" ? "bg-[#101828] text-white" : "bg-[#F2F4F7] text-[#344054]"}`}>Upcoming ({upcoming.length})</button>
        <button type="button" onClick={() => setTab("history")} className={`rounded-xl px-4 py-2.5 text-[13px] font-bold ${tab === "history" ? "bg-[#101828] text-white" : "bg-[#F2F4F7] text-[#344054]"}`}>History ({history.length})</button>
      </div>
      {notice && <p role="status" className="mt-4 rounded-[12px] bg-[#ECFDF3] p-4 text-[13px] font-bold text-[#027A48]">{notice}</p>}
      {error && <p role="alert" className="mt-4 rounded-[12px] bg-[#FEF3F2] p-4 text-[13px] text-[#B42318]">{error}</p>}
      {loading ? <p className="mt-6 text-[14px] text-[#667085]">Loading bookings…</p> : visible.length === 0 ? (
        <div className="mt-6 rounded-[17px] border border-dashed border-[#BAC7D7] bg-[#F8FAFC] p-8 text-center">
          <p className="text-[30px]">🚗</p><p className="mt-2 font-bold text-[#101828]">{tab === "upcoming" ? "No upcoming appointments yet." : "No previous appointments."}</p>
          <p className="mt-1 text-[13px] text-[#667085]">Browse garages and choose the right service in a few taps.</p>
        </div>
      ) : <div className="mt-5 space-y-4">
        {visible.map((booking) => {
          const review = reviews.find((r) => r.booking_id === booking.id);
          const ended = new Date(booking.ends_at).getTime() <= now;
          return <article key={booking.id} className="rounded-[18px] border border-[#BAC7D7] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[12px] font-bold uppercase tracking-wide text-[#4771A6]">{booking.service_name}</p>
                <h3 className="mt-1 text-[20px] font-extrabold text-[#101828]">{booking.garage_name}</h3>
                <p className="mt-2 text-[14px] font-bold text-[#344054]">📅 {formatMontrealDateTime(booking.starts_at)} · {booking.duration_minutes} min</p></div>
              <span className={`rounded-full px-3 py-2 text-[12px] font-bold ${booking.status === "confirmed" ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]"}`}>{booking.status.replaceAll("_", " ")}</span>
            </div>
            <p className="mt-3 text-[13px] text-[#667085]">📍 {booking.garage_address}</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
              {booking.garage_phone && <a className="font-bold text-[#315C91] underline" href={`tel:${booking.garage_phone.replace(/[^\d+]/g, "")}`}>📞 {booking.garage_phone}</a>}
              {booking.garage_email && <a className="font-bold text-[#315C91] underline" href={`mailto:${booking.garage_email}`}>✉️ Email garage</a>}
            </div>
            {booking.note && <p className="mt-2 text-[12px] text-[#667085]">Your note: {booking.note}</p>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF2F6] pt-4">
              <p className="text-[15px] font-extrabold text-[#101828]">{formatPriceCents(booking.price_cents)} <span className="text-[11px] font-normal text-[#667085]">· Pay at garage</span></p>
              {booking.status === "confirmed" && !ended && <button type="button" disabled={pendingId === booking.id} onClick={() => void cancel(booking)} className="rounded-[12px] border border-[#FDA29B] px-4 py-2.5 text-[12px] font-bold text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-50">{pendingId === booking.id ? "Cancelling…" : "Cancel booking"}</button>}
            </div>
            {booking.status === "confirmed" && ended && (review ?
              <p className="mt-4 rounded-[13px] bg-[#ECFDF3] p-4 text-[13px] text-[#027A48]">✓ You reviewed this garage: {"★".repeat(review.stars)}{review.comment ? ` · ${review.comment}` : ""}</p> :
              <ReviewForm bookingId={booking.id} onDone={() => void refresh()} />
            )}
          </article>;
        })}
      </div>}
    </section>
  );
}
