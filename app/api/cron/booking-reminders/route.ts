import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createDispatchAdminClient } from "@/lib/supabase/dispatch-admin";
import { sendBookingReminderEmail } from "@/lib/email/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ReminderRow = {
  booking_id: string;
  client_email: string;
  client_name: string;
  garage_name: string;
  garage_address: string;
  service_name: string;
  starts_at: string;
  towing_pending: boolean;
};

function authorized(request: NextRequest, configured: string): boolean {
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${configured}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/**
 * Called by the existing GitHub Actions reminder workflow every 15 minutes.
 * A database claim + lease allows safe retries and prevents routine duplicates.
 * This route requires MECATREX_CRON_SECRET and the server-only service-role key.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.MECATREX_CRON_SECRET?.trim();
  if (!secret || !authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createDispatchAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Missing server-only Supabase credentials" }, { status: 503 });
  }
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    return NextResponse.json({ error: "Missing Brevo configuration" }, { status: 503 });
  }

  const { data, error } = await admin.rpc("claim_due_booking_reminders", { p_limit: 20 });
  if (error) {
    console.error("MECATREX reminder claim failed:", error.message);
    return NextResponse.json({ error: "Reminder queue unavailable" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const row of (data ?? []) as ReminderRow[]) {
    try {
      // Check again after claiming: the appointment could have been cancelled.
      const current = await admin.from("garage_bookings")
        .select("status").eq("id", row.booking_id).maybeSingle();
      if (current.error || current.data?.status !== "confirmed") {
        await admin.rpc("complete_booking_reminder", {
          p_booking_id: row.booking_id, p_success: false, p_error: "Appointment no longer active",
        });
        continue;
      }
      await sendBookingReminderEmail({
        clientEmail: row.client_email,
        clientName: row.client_name,
        garageName: row.garage_name,
        garageAddress: row.garage_address,
        serviceName: row.service_name,
        startsAt: row.starts_at,
        towingPending: row.towing_pending,
      });
      const { error: recorded } = await admin.rpc("complete_booking_reminder", {
        p_booking_id: row.booking_id, p_success: true, p_error: "",
      });
      if (recorded) throw new Error(`Could not log reminder delivery: ${recorded.message}`);
      sent++;
    } catch (failure) {
      failed++;
      const detail = failure instanceof Error ? failure.message : "Unknown mailer error";
      console.error("MECATREX reminder failed:", row.booking_id, detail);
      const { error: recorded } = await admin.rpc("complete_booking_reminder", {
        p_booking_id: row.booking_id, p_success: false, p_error: detail.slice(0,300),
      });
      if (recorded) console.error("Failed to release reminder claim:", row.booking_id, recorded.message);
    }
  }
  return NextResponse.json({ processed: (data ?? []).length, sent, failed }, {
    status: failed ? 500 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
