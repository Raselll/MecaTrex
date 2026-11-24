"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createDispatchAdminClient } from "@/lib/supabase/dispatch-admin";
import { sendBookingEmailNotifications, sendMecatrexNotice } from "@/lib/email/brevo";

type BookingResult = { ok: true; bookingId: string; message?: string } | { ok: false; error: string };
type BookingMailRecipients = {
  client_email: string;
  client_name: string;
  provider_email: string;
  provider_name: string;
  service_name: string;
  vehicle_description: string;
  starts_at: string;
  ends_at: string;
};


function formValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function notifyParticipants(
  bookingId: string,
  event: "confirmed" | "provider_cancelled" | "client_cancelled",
  extra: { towingPending?: boolean; cancellationRemaining?: number; freeCancellation?: boolean } = {}
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("booking_email_recipients", { p_booking_id: bookingId })
    .maybeSingle();
  if (error || !data) {
    console.error("Could not load booking email recipients:", error?.message);
    return;
  }
  const recipients = data as BookingMailRecipients;
  if (!recipients.client_email || !recipients.provider_email) {
    console.warn("Booking saved; one email address is missing. Both in-app notifications are stored.");
    return;
  }
  await sendBookingEmailNotifications({
    event,
    clientEmail: recipients.client_email,
    clientName: recipients.client_name,
    providerEmail: recipients.provider_email,
    providerName: recipients.provider_name,
    serviceName: recipients.service_name,
    vehicleDescription: recipients.vehicle_description,
    startsAt: recipients.starts_at,
    endsAt: recipients.ends_at,
    ...extra,
  });
}

type TowingDispatchRecipient = {
  email: string;
  company_name: string;
  garage_name: string;
  service_name: string;
  appointment_at: string;
  pickup_address: string;
};

async function notifyAvailableTowingProviders(bookingId: string) {
  const dispatchAdmin = createDispatchAdminClient();
  if (!dispatchAdmin) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is missing; towing in-app notices remain available, but bulk towing emails are disabled.");
    return;
  }
  const { data, error } = await dispatchAdmin.rpc("towing_dispatch_email_recipients", {
    p_booking_id: bookingId,
  });
  if (error) {
    console.error("Cannot find eligible towing emails:", error.message);
    return;
  }
  const recipients = (data ?? []) as TowingDispatchRecipient[];
  const appointment = (value: string) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", dateStyle: "full", timeStyle: "short",
  }).format(new Date(value));

  for (let i = 0; i < recipients.length; i += 10) {
    const batch = recipients.slice(i, i + 10);
    const result = await Promise.allSettled(batch.map((recipient) =>
      sendMecatrexNotice({
        email: recipient.email,
        name: recipient.company_name,
        subject: "MECATREX · New towing opportunity",
        message: `A client needs towing for ${recipient.service_name} at ${recipient.garage_name} on ${appointment(recipient.appointment_at)}. Pickup address: ${recipient.pickup_address}. Open Towing jobs to accept or decline. The first eligible company to accept gets the job.`,
        accountPath: "/account",
      })
    ));
    if (result.some((item) => item.status === "rejected")) {
      console.error("One or more towing opportunity emails failed; in-app notices remain available.");
    }
  }
}

export async function createGarageBooking(formData: FormData): Promise<BookingResult> {
  const providerId = formValue(formData, "provider_id");
  let serviceIds: string[];
  try {
    const parsed: unknown = JSON.parse(formValue(formData, "service_ids"));
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 50 ||
        !parsed.every((value) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value))) {
      return { ok: false, error: "Select at least one valid service." };
    }
    serviceIds = parsed as string[];
    if (new Set(serviceIds).size !== serviceIds.length) {
      return { ok: false, error: "Each service can only be selected once." };
    }
  } catch {
    return { ok: false, error: "Select at least one service." };
  }
  const day = formValue(formData, "day");
  const time = formValue(formData, "time");
  const note = formValue(formData, "note");
  const vehicle = formValue(formData, "vehicle").slice(0, 120);
  const wantsTowing = formValue(formData, "wants_towing") === "yes";
  const pickupAddress = formValue(formData, "pickup_address");
  const towingNote = formValue(formData, "towing_note");
  if (!providerId || serviceIds.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(day)
      || !/^([01]\d|2[0-3]):(00|30)$/.test(time) || note.length > 500) {
    return { ok: false, error: "Choose a valid garage, service, date, time and a note shorter than 500 characters." };
  }

  if (wantsTowing && (pickupAddress.length < 8 || pickupAddress.length > 240 || towingNote.length > 500)) {
    return { ok: false, error: "Enter a towing pickup address (8–240 characters) and keep the towing note under 500 characters." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please log in with a client account before confirming a booking." };

  // Atomically reserve the combined duration and snapshot every item.
  // When towing is requested, the same transaction also creates its pending dispatch.
  const { data, error } = serviceIds.length === 1
    ? wantsTowing
      ? await supabase.rpc("book_garage_service_with_towing", {
          p_provider_id: providerId,
          p_service_id: serviceIds[0],
          p_day: day, p_time: time, p_note: note, p_vehicle: vehicle,
          p_wants_towing: true, p_pickup_address: pickupAddress, p_towing_note: towingNote,
        })
      : await supabase.rpc("book_garage_service", {
          p_provider_id: providerId,
          p_service_id: serviceIds[0],
          p_day: day, p_time: time, p_note: note, p_vehicle: vehicle,
        })
    : await supabase.rpc("book_garage_services", {
        p_provider_id: providerId,
        p_service_ids: serviceIds,
        p_day: day,
        p_time: time,
        p_note: note,
        p_vehicle: vehicle,
        p_wants_towing: wantsTowing,
        p_pickup_address: wantsTowing ? pickupAddress : "",
        p_towing_note: wantsTowing ? towingNote : "",
      });

  if (error || typeof data !== "string") {
    if (error?.code === "PGRST202") {
      return { ok: false, error: "Multi-service bookings require the latest MECATREX Supabase migrations. Apply them before booking." };
    }
    return { ok: false, error: error?.message ?? "Could not book this time. Please select another." };
  }

  // The booking is already committed. Email delivery must never undo a real reservation.
  try {
    await notifyParticipants(data, "confirmed", { towingPending: wantsTowing });
    if (wantsTowing) await notifyAvailableTowingProviders(data);
  } catch (error) {
    console.error("Booking saved, email delivery unavailable:", error);
  }

  revalidatePath("/account");
  revalidatePath("/");
  return { ok: true, bookingId: data, message: wantsTowing ? "Garage time reserved. Full confirmation is pending towing acceptance." : undefined };
}

export async function cancelGarageBooking(bookingId: string):
  Promise<{ ok: boolean; message: string; remaining?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };
  // Capture the accepted tow company's contact before the cancellation
  // trigger closes the towing request and hides the original assignment.
  const { data: linkedTowing } = await supabase
    .from("towing_requests").select("id,status").eq("booking_id",bookingId).maybeSingle();
  const { data: towingDetails } = linkedTowing?.status === "accepted"
    ? await supabase.rpc("towing_party_email_details", {
        p_request_id: linkedTowing.id,
      }).maybeSingle()
    : { data: null };

  const { data, error } = await supabase.rpc("cancel_garage_booking", { p_booking_id: bookingId });
  if (error) return { ok: false, message: error.message };

  // Derive the cancellation actor from the database, not an untrusted client argument.
  const { data: updatedBooking } = await supabase
    .from("garage_bookings").select("status,created_at,cancelled_at").eq("id", bookingId).single();
  const actualProviderCancellation = updatedBooking?.status === "provider_cancelled";
  const freeCancellation = !actualProviderCancellation &&
    !!updatedBooking?.created_at && !!updatedBooking?.cancelled_at &&
    new Date(updatedBooking.cancelled_at).getTime() <= new Date(updatedBooking.created_at).getTime() + 24 * 60 * 60 * 1000;
  const remaining = typeof data === "number" ? data : 0;
  try {
    await notifyParticipants(bookingId,
      actualProviderCancellation ? "provider_cancelled" : "client_cancelled",
      { cancellationRemaining: remaining, freeCancellation });
    if (towingDetails) {
      const tow = towingDetails as { towing_email: string; towing_name: string; garage_name: string;
        client_name: string; service_name: string; appointment_at: string };
      await sendMecatrexNotice({
        email: tow.towing_email,
        name: tow.towing_name,
        subject: "MECATREX · Accepted towing trip cancelled",
        message: `The ${tow.service_name} garage appointment at ${tow.garage_name} for ${tow.client_name} was cancelled. Your towing assignment is also cancelled and will disappear from your calendar. No towing cancellation penalty applies because the garage or client cancelled.`,
      });
    }
  } catch (mailError) {
    console.error("Cancellation saved, email notification unavailable:", mailError);
  }

  revalidatePath("/account");
  revalidatePath("/");
  return { ok: true, message: actualProviderCancellation
    ? remaining === 0 ? "Third garage cancellation: your listing is suspended. Contact MECATREX." : `Garage cancellation warning. ${remaining} of 3 cancellations remaining.`
    : freeCancellation ? "Booking cancelled within the 24-hour grace period. No strike was counted."
    : remaining === 0 ? "Cancellation warning 3/3. Your account is now suspended from making new bookings."
    : `Cancellation warning. ${remaining} of 3 late cancellations remain.`,
    remaining };
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
