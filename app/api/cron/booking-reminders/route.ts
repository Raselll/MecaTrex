import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendBookingReminderEmail } from "@/lib/email/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_HOUR_MS = 60 * 60 * 1000;
const REMINDER_TITLE = "Appointment reminder: tomorrow";

type Booking = {
  id: string;
  client_id: string;
  client_email: string;
  client_name: string;
  garage_name: string;
  garage_address: string;
  service_name: string;
  starts_at: string;
};

type Delivery = {
  booking_id: string;
  claimed_at: string;
  email_sent_at: string | null;
  notification_sent_at: string | null;
};

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Trigger via an authenticated scheduler (see .github/workflows/booking-reminders.yml).
 * A delivery record ensures emails and in-app reminders are sent at most once
 * during normal operation, and failed steps can be retried independently.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.MECATREX_CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return json({
      ok: false,
      error: "Missing server-only Supabase credentials.",
    }, 503);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = Date.now();
  const { data, error } = await supabase
    .from("garage_bookings")
    .select("id,client_id,client_email,client_name,garage_name,garage_address,service_name,starts_at")
    .eq("status", "confirmed")
    .gt("starts_at", new Date(now + MIN_HOUR_MS).toISOString())
    .lte("starts_at", new Date(now + DAY_MS).toISOString())
    .order("starts_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("Booking reminder query failed:", error.message);
    return json({ ok: false, error: "Could not load upcoming bookings." }, 500);
  }

  let notifications = 0;
  let emails = 0;
  let failures = 0;
  let claimed = 0;

  for (const booking of (data ?? []) as Booking[]) {
    // Claim each booking atomically. A stale claim can be retried after 15 minutes.
    const claimedAt = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from("booking_reminder_deliveries")
      .insert({ booking_id: booking.id, claimed_at: claimedAt })
      .select("booking_id,claimed_at,email_sent_at,notification_sent_at")
      .maybeSingle();

    let delivery = inserted as Delivery | null;
    if (insertError?.code === "23505") {
      const leaseExpired = new Date(Date.now() - 15 * 60_000).toISOString();
      const retry = await supabase
        .from("booking_reminder_deliveries")
        .update({ claimed_at: claimedAt, updated_at: claimedAt })
        .eq("booking_id", booking.id)
        .lt("claimed_at", leaseExpired)
        .select("booking_id,claimed_at,email_sent_at,notification_sent_at")
        .maybeSingle();

      if (retry.error) {
        failures++;
        console.error("Reminder retry claim failed:", retry.error.message);
        continue;
      }
      delivery = retry.data as Delivery | null;
    } else if (insertError) {
      failures++;
      console.error("Reminder claim failed (apply reminder migration first):", insertError.message);
      continue;
    }

    if (!delivery || (delivery.email_sent_at && delivery.notification_sent_at)) {
      continue;
    }

    // A customer or garage may have cancelled since the initial query.
    const currentBooking = await supabase
      .from("garage_bookings")
      .select("status")
      .eq("id", booking.id)
      .maybeSingle();
    if (currentBooking.error || currentBooking.data?.status !== "confirmed") {
      continue;
    }

    claimed++;

    if (!delivery.notification_sent_at) {
      const when = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(booking.starts_at));

      const notice = await supabase.from("booking_notifications").insert({
        recipient_id: booking.client_id,
        booking_id: booking.id,
        title: REMINDER_TITLE,
        body: `Your ${booking.service_name} appointment at ${booking.garage_name} is coming up on ${when} (Montreal time). Address: ${booking.garage_address}.`,
      });

      // A unique partial index makes a retry harmless if the notice already exists.
      if (!notice.error || notice.error.code === "23505") {
        const saved = await supabase
          .from("booking_reminder_deliveries")
          .update({ notification_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("booking_id", booking.id);
        if (saved.error) {
          failures++;
          console.error("Reminder notice tracking failed:", saved.error.message);
        } else {
          notifications++;
        }
      } else {
        failures++;
        console.error("Reminder notification failed:", notice.error.message);
      }
    }

    if (!delivery.email_sent_at) {
      try {
        await sendBookingReminderEmail({
          clientEmail: booking.client_email,
          clientName: booking.client_name,
          garageName: booking.garage_name,
          garageAddress: booking.garage_address,
          serviceName: booking.service_name,
          startsAt: booking.starts_at,
        });

        const marked = await supabase
          .from("booking_reminder_deliveries")
          .update({
            email_sent_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("booking_id", booking.id);

        if (marked.error) {
          failures++;
          console.error("Reminder email tracking failed:", marked.error.message);
        } else {
          emails++;
        }
      } catch (error) {
        failures++;
        const message = error instanceof Error ? error.message : "Email failed";
        console.error("MECATREX reminder email error:", message);
        await supabase
          .from("booking_reminder_deliveries")
          .update({ last_error: message.slice(0, 300), updated_at: new Date().toISOString() })
          .eq("booking_id", booking.id);
      }
    }
  }

  return json({
    ok: failures === 0,
    scanned: (data ?? []).length,
    claimed,
    notifications,
    emails,
    failures,
  }, failures > 0 ? 500 : 200);
}
