"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendBookingEmailNotifications } from "@/lib/email/brevo";

type BookingResult = { ok: true; bookingId: string; message?: string } | { ok: false; error: string };

function formValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function notifyParticipants(bookingId: string, event: "confirmed" | "provider_cancelled" | "client_cancelled") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("booking_email_recipients", { p_booking_id: bookingId })
    .maybeSingle();
  if (error || !data) {
    console.error("Could not load booking email recipients:", error?.message);
    return;
  }
  if (!data.client_email || !data.provider_email) {
    console.warn("Booking saved; one email address is missing. Both in-app notifications are stored.");
    return;
  }
  await sendBookingEmailNotifications({
    event,
    clientEmail: data.client_email,
    clientName: data.client_name,
    providerEmail: data.provider_email,
    providerName: data.provider_name,
    serviceName: data.service_name,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
  });
}

export async function createGarageBooking(formData: FormData): Promise<BookingResult> {
  const providerId = formValue(formData, "provider_id");
  const serviceId = formValue(formData, "service_id");
  const day = formValue(formData, "day");
  const time = formValue(formData, "time");
  const note = formValue(formData, "note");
  if (!providerId || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(day)
      || !/^([01]\d|2[0-3]):(00|30)$/.test(time) || note.length > 500) {
    return { ok: false, error: "Choose a valid garage, service, date, time and a note shorter than 500 characters." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in with a client account before confirming a booking." };

  const { data, error } = await supabase.rpc("book_garage_service", {
    p_provider_id: providerId,
    p_service_id: serviceId,
    p_day: day,
    p_time: time,
    p_note: note,
  });

  if (error || typeof data !== "string") {
    return { ok: false, error: error?.message ?? "Could not book this time. Please select another." };
  }

  // The booking is already committed. Email delivery must never undo a real reservation.
  try { await notifyParticipants(data, "confirmed"); }
  catch (error) { console.error("Booking confirmed, email delivery unavailable:", error); }

  revalidatePath("/account");
  revalidatePath("/");
  return { ok: true, bookingId: data };
}

export async function cancelGarageBooking(bookingId: string):
  Promise<{ ok: boolean; message: string; remaining?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };
  const { data, error } = await supabase.rpc("cancel_garage_booking", { p_booking_id: bookingId });
  if (error) return { ok: false, message: error.message };

  // Derive the cancellation actor from the database, not an untrusted client argument.
  const { data: updatedBooking } = await supabase
    .from("garage_bookings").select("status").eq("id", bookingId).single();
  const actualProviderCancellation = updatedBooking?.status === "provider_cancelled";
  try {
    await notifyParticipants(bookingId, actualProviderCancellation ? "provider_cancelled" : "client_cancelled");
  } catch (mailError) {
    console.error("Cancellation saved, email notification unavailable:", mailError);
  }

  revalidatePath("/account");
  revalidatePath("/");
  return { ok: true, message: actualProviderCancellation
    ? `Appointment cancelled. ${data} garage cancellations remaining before suspension.`
    : "Appointment cancelled. The garage was notified.", remaining: typeof data === "number" ? data : undefined };
}

export async function reviewGarageBooking(
  bookingId: string, stars: number, comment: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in." };
  if (!Number.isInteger(stars) || stars < 1 || stars > 5 || comment.length > 1000) {
    return { ok: false, message: "Choose 1–5 stars and keep your review under 1,000 characters." };
  }
  const { error } = await supabase.rpc("submit_garage_review", {
    p_booking_id: bookingId, p_stars: stars, p_comment: comment,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/account");
  revalidatePath("/");
  return { ok: true, message: "Thanks! Your garage review is now visible." };
}
