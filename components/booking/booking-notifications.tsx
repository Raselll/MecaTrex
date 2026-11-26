"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AlertRow = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export default function BookingNotifications({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("booking_notifications")
      .select("id,title,body,read_at,created_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (loadError) {
      setError("Could not load your notifications.");
    } else {
      setError("");
      setAlerts((data ?? []) as AlertRow[]);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const unread = alerts.filter((alert) => !alert.read_at).length;
  const dueReminder = alerts.find((alert) =>
    !alert.read_at &&
    alert.title === "Appointment reminder: tomorrow" &&
    !dismissedReminderIds.includes(alert.id)
  );

  function dismissReminder(id: string) {
    setDismissedReminderIds((current) => [...current, id]);
    void markRead(id);
  }

  async function markRead(id: string) {
    const { error: updateError } = await supabase
      .from("booking_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("recipient_id", userId);

    if (updateError) {
      setError("The notification could not be marked as read.");
      return;
    }
    setAlerts((current) =>
      current.map((alert) =>
        alert.id === id ? { ...alert, read_at: new Date().toISOString() } : alert
      )
    );
  }

  return (
    <div className="relative z-40 shrink-0">
      <button
        type="button"
        aria-label={unread > 0 ? "Notifications: " + unread + " unread" : "Notifications"}
        aria-expanded={open}
        aria-controls="mecatrex-notification-popover"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#D4DFEA] bg-white text-[22px] shadow-sm transition hover:border-[#FF5B13] hover:bg-[#FFF1E8]"
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#C62828] px-1 text-[10px] font-extrabold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="mecatrex-notification-popover"
          className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(88vw,390px)] overflow-hidden rounded-[20px] border border-[#E9DED5] bg-white shadow-[0_22px_70px_rgba(16,24,40,0.20)]"
          role="region"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#E4EAF1] bg-[#F8FAFC] px-4 py-3.5">
            <div>
              <p className="text-[15px] font-extrabold text-[#101828]">Notifications</p>
              <p className="mt-0.5 text-[11px] text-[#667085]">
                {unread > 0 ? unread + " unread" : "You're all caught up"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => void refresh()} className="rounded-lg px-2.5 py-2 text-[11px] font-bold text-[#DD4E0D] hover:bg-[#E8F0FA]">
                Refresh
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="rounded-lg px-2.5 py-2 text-[16px] font-bold text-[#475467] hover:bg-[#E8F0FA]">
                ×
              </button>
            </div>
          </div>

          {error && <p role="alert" className="m-3 rounded-lg bg-[#FEF3F2] p-3 text-[12px] text-[#B42318]">{error}</p>}

          {alerts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[28px]">✉️</p>
              <p className="mt-2 text-[14px] font-bold text-[#101828]">Nothing new yet</p>
              <p className="mt-1 text-[12px] leading-5 text-[#667085]">
                Booking confirmations and calendar updates will appear here.
              </p>
            </div>
          ) : (
            <div className="max-h-[420px] divide-y divide-[#EDF1F6] overflow-y-auto">
              {alerts.map((alert) => (
                <article key={alert.id} className={"p-4 " + (alert.read_at ? "bg-white" : "bg-[#EFF5FC]")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-extrabold text-[#101828]">{alert.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-[#475467]">{alert.body}</p>
                      <p className="mt-2 text-[10px] text-[#98A2B3]">{new Date(alert.created_at).toLocaleString("en-CA")}</p>
                    </div>
                    {!alert.read_at && (
                      <button type="button" onClick={() => void markRead(alert.id)} className="shrink-0 rounded-lg border border-[#C4D6EC] bg-white px-2.5 py-2 text-[10px] font-bold text-[#DD4E0D] hover:bg-[#FFF1E8]">
                        Mark read
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {dueReminder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101828]/55 p-4 backdrop-blur-[3px]">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mecatrex-reminder-title"
            aria-describedby="mecatrex-reminder-description"
            className="w-full max-w-[470px] rounded-[25px] border border-[#E9DED5] bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.2)] sm:p-8"
          >
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1E8] text-[30px]">
              📅
            </div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#FF5B13]">
              BandWhip appointment reminder
            </p>
            <h2 id="mecatrex-reminder-title" className="mt-2 text-[24px] font-extrabold text-[#101828]">
              Your appointment is coming up!
            </h2>
            <p id="mecatrex-reminder-description" className="mt-3 whitespace-pre-line text-[14px] leading-7 text-[#475467]">
              {dueReminder.body}
            </p>
            <p className="mt-4 text-[12px] text-[#667085]">
              You can review your booking under My appointments.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => dismissReminder(dueReminder.id)}
              className="mt-6 w-full rounded-[13px] bg-[#FF5B13] px-5 py-3.5 text-[14px] font-extrabold text-white hover:bg-[#DD4E0D]"
            >
              Got it — thanks!
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
