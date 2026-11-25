"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendMecatrexNotice } from "@/lib/email/brevo";

type VisitResult = { ok: true; message: string; code?: string } | { ok: false; message: string };

function errorMessage(error: { message: string } | null, fallback: string) {
  return error?.message ?? fallback;
}

export async function revealGarageHandoffCode(bookingId: string): Promise<VisitResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Garage login required." };
  const { data, error } = await supabase.rpc("issue_garage_handoff_code", { p_booking_id: bookingId });
  if (error || typeof data !== "string") {
    return { ok: false, message: errorMessage(error, "Unable to generate handoff code.") };
  }
  return { ok: true, code: data, message: "Share this code only after physically receiving the vehicle." };
}

export async function confirmVehicleDropoff(bookingId: string, code: string): Promise<VisitResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Client login required." };
  const { data, error } = await supabase.rpc("confirm_vehicle_dropoff", {
    p_booking_id: bookingId, p_code: code.trim().toUpperCase(),
  });
  if (error) return { ok: false, message: error.message };
  if (data !== true) return { ok: false, message: "Code invalid or too many attempts. Ask the garage to verify the handoff code." };
  revalidatePath("/account");
  return { ok: true, message: "Vehicle drop-off recorded. The garage has been notified." };
}

export async function markVisitServiceReady(bookingId: string): Promise<VisitResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Garage login required." };
  const { data, error } = await supabase.rpc("mark_vehicle_ready", { p_booking_id: bookingId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/account");
  return {
    ok: true,
    message: data === false
      ? "Service was already marked complete. You can notify the client by email."
      : "Service completed. The client now sees Vehicle ready and has an in-app notification. Send their pickup email using the button below.",
  };
}

export async function emailClientVehicleReady(bookingId: string): Promise<VisitResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Garage login required." };
  const { data: claimed, error: claimError } = await supabase.rpc("claim_vehicle_ready_email", {
    p_booking_id: bookingId,
  });
  if (claimError) return { ok: false, message: claimError.message };
  if (!claimed) return { ok: false, message: "Pickup email was already sent, or another delivery is in progress. Please check the current status." };

  try {
    const { data: booking, error } = await supabase.from("garage_bookings")
      .select("client_name,client_email,garage_name,garage_address,service_name,garage_phone")
      .eq("id", bookingId).single();
    if (error || !booking?.client_email) throw new Error(error?.message ?? "Client email unavailable.");
    await sendMecatrexNotice({
      email: booking.client_email,
      name: booking.client_name,
      subject: "MECATREX · Your vehicle is ready for pickup",
      message: `Your vehicle service (${booking.service_name}) is complete at ${booking.garage_name}. You can pick up your car at ${booking.garage_address}. Please contact the garage if needed: ${booking.garage_phone || "see your appointment"}. After collecting your vehicle, confirm pickup under My appointments in MECATREX.`,
      accountPath: "/account?view=appointments",
    });
    const { error: doneError } = await supabase.rpc("complete_vehicle_ready_email", {
      p_booking_id: bookingId, p_success: true,
    });
    if (doneError) throw new Error(doneError.message);
    revalidatePath("/account");
    return { ok: true, message: "Pickup notification email sent successfully." };
  } catch (cause) {
    await supabase.rpc("complete_vehicle_ready_email", {
      p_booking_id: bookingId, p_success: false,
    });
    console.error("MECATREX pickup email failed:", cause);
    return { ok: false, message: cause instanceof Error ? cause.message : "Could not email the client. Please try again." };
  }
}

export async function confirmClientVehiclePickup(bookingId: string, received: boolean): Promise<VisitResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Client login required." };
  const { data, error } = await supabase.rpc("confirm_vehicle_pickup", {
    p_booking_id: bookingId, p_received: received,
  });
  if (error) return { ok: false, message: error.message };
  if (data !== true) return { ok: false, message: "No status change was recorded. Refresh the appointment." };
  revalidatePath("/account");
  return {
    ok: true,
    message: received
      ? "You confirmed vehicle pickup. The visit is closed and the garage was notified."
      : "The garage was notified that you have not received your car. The visit remains open.",
  };
}
