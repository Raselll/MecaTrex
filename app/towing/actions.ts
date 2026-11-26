"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createDispatchAdminClient } from "@/lib/supabase/dispatch-admin";
import { sendMecatrexNotice } from "@/lib/email/brevo";

type ActionResult = { ok: boolean; message: string; remaining?: number };

type TowingParticipants = {
  client_email: string;
  client_name: string;
  garage_email: string;
  garage_name: string;
  towing_email: string;
  towing_name: string;
  service_name: string;
  appointment_at: string;
  pickup_address: string;
  garage_address: string;
};

type DispatchRecipient = {
  email: string;
  company_name: string;
  garage_name: string;
  service_name: string;
  appointment_at: string;
  pickup_address: string;
};

function appointmentTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", dateStyle: "full", timeStyle: "short",
  }).format(new Date(value));
}

async function sendPartyNotices(
  data: TowingParticipants,
  event: "accepted" | "cancelled",
  remaining?: number
) {
  const when = appointmentTime(data.appointment_at);
  const destination = `${data.garage_name} (${data.garage_address})`;
  const details = `Service: ${data.service_name}. Garage arrival: ${when}. Pickup: ${data.pickup_address}. Destination: ${destination}.`;
  const cancelled = event === "cancelled";
  const messages = cancelled
    ? [
      { email: data.client_email, name: data.client_name, subject: "BandWhip · Towing provider cancelled",
        message: `${data.towing_name} cancelled the towing portion of your booking. Your garage time remains reserved, but the full trip is pending another towing company. ${details}` },
      { email: data.garage_email, name: data.garage_name, subject: "BandWhip · Towing company withdrew",
        message: `${data.towing_name} withdrew the accepted towing trip for ${data.client_name}. The garage booking stays reserved while dispatch reopens. ${details}` },
      { email: data.towing_email, name: data.towing_name, subject: "BandWhip · Towing cancellation warning",
        message: `Your towing cancellation has been counted. ${remaining ?? 0} cancellation(s) remain before suspension. ${remaining === 0 ? "Your towing listing is now suspended. Contact BandWhip." : ""} ${details}` },
    ]
    : [
      { email: data.client_email, name: data.client_name, subject: "BandWhip · Garage and towing confirmed",
        message: `${data.towing_name} has accepted your towing request. Your full garage-and-towing booking is confirmed. Contact the towing company to agree on pickup time and towing charges. ${details}` },
      { email: data.garage_email, name: data.garage_name, subject: "BandWhip · Towing confirmed for your booking",
        message: `${data.towing_name} accepted the towing job for ${data.client_name}. The full booking is now confirmed. ${details}` },
      { email: data.towing_email, name: data.towing_name, subject: "BandWhip · Your towing job is confirmed",
        message: `You accepted towing for ${data.client_name}. Coordinate pickup and your towing price with the client. ${details}` },
    ];

  const outcomes = await Promise.allSettled(messages.map((item) =>
    sendMecatrexNotice({ ...item, accountPath: "/account" })
  ));
  if (outcomes.some((item) => item.status === "rejected")) {
    console.error("Some BandWhip towing participant emails could not be delivered.");
  }
}

async function notifyAvailableCompanies(bookingId: string) {
  const dispatchAdmin = createDispatchAdminClient();
  if (!dispatchAdmin) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is missing; towing in-app notices remain available, but bulk towing emails are disabled.");
    return;
  }
  const { data, error } = await dispatchAdmin.rpc("towing_dispatch_email_recipients", {
    p_booking_id: bookingId,
  });
  if (error) {
    console.error("Unable to load reopened towing recipients:", error.message);
    return;
  }
  const rows = (data ?? []) as DispatchRecipient[];
  for (let i = 0; i < rows.length; i += 10) {
    const results = await Promise.allSettled(rows.slice(i, i + 10).map((row) =>
      sendMecatrexNotice({
        email: row.email, name: row.company_name,
        subject: "BandWhip · Towing opportunity reopened",
        message: `A towing trip is available for ${row.service_name} at ${row.garage_name}, arriving ${appointmentTime(row.appointment_at)}. Pickup: ${row.pickup_address}. Open Towing jobs to accept or decline.`,
      })
    ));
    if (results.some((result) => result.status === "rejected")) {
      console.error("Some reopened towing opportunity emails failed.");
    }
  }
}

export async function acceptTowingJob(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Log in to your towing account." };

  const { error } = await supabase.rpc("accept_towing_request", { p_request_id: requestId });
  if (error) return { ok: false, message: error.message };

  const { data: details, error: detailsError } = await supabase
    .rpc("towing_party_email_details", { p_request_id: requestId }).maybeSingle();
  if (detailsError) console.error("Could not retrieve accepted towing participants:", detailsError.message);
  if (details) await sendPartyNotices(details as TowingParticipants, "accepted");
  revalidatePath("/account");
  return { ok: true, message: "Towing accepted. The client, garage and towing company have been notified; the full booking is confirmed." };
}

export async function declineTowingJob(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in." };
  const { error } = await supabase.rpc("decline_towing_opportunity", { p_request_id: requestId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/account");
  return { ok: true, message: "Opportunity declined. No cancellation warning was counted." };
}

export async function cancelAcceptedTowingJob(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in." };
  // Read recipient details BEFORE release, as an unassigned request no longer exposes its old provider.
  const [{ data: details }, { data: request }] = await Promise.all([
    supabase.rpc("towing_party_email_details", { p_request_id: requestId }).maybeSingle(),
    supabase.from("towing_requests").select("booking_id").eq("id", requestId).maybeSingle(),
  ]);
  const { data: remaining, error } = await supabase.rpc("cancel_accepted_towing_request", {
    p_request_id: requestId,
  });
  if (error) return { ok: false, message: error.message };
  try {
    if (details) await sendPartyNotices(details as TowingParticipants, "cancelled", remaining as number);
    if (request?.booking_id) await notifyAvailableCompanies(request.booking_id);
  } catch (mailError) {
    console.error("Towing released; email delivery unavailable:", mailError);
  }
  revalidatePath("/account");
  return {
    ok: true,
    remaining: typeof remaining === "number" ? remaining : undefined,
    message: remaining === 0
      ? "Third towing cancellation: your listing is suspended. Contact BandWhip."
      : `Towing cancellation warning. ${remaining} cancellation(s) remain before suspension. The job was reopened to other companies.`,
  };
}
