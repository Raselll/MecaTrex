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

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("booking_notifications")
      .select("id,title,body,read_at,created_at")
      .eq("recipient_id", userId).order("created_at", { ascending: false }).limit(12);
    if (data) setAlerts(data as AlertRow[]);
  }, [supabase, userId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const unread = alerts.filter((alert) => !alert.read_at).length;

  async function markRead(id: string) {
    const { error } = await supabase.from("booking_notifications")
      .update({ read_at: new Date().toISOString() }).eq("id", id).eq("recipient_id", userId);
    if (!error) setAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, read_at: new Date().toISOString() } : alert));
  }

  return (
    <section className="rounded-[22px] border border-[#D5DFEA] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#4771A6]">Updates</p>
          <h2 className="mt-1 text-[21px] font-extrabold text-[#101828]">🔔 Notifications {unread > 0 && <span className="rounded-full bg-[#FEE4E2] px-2.5 py-1 text-[12px] text-[#B42318]">{unread} new</span>}</h2>
        </div>
        <button type="button" onClick={() => void refresh()} className="rounded-[12px] border border-[#BAC7D7] px-4 py-2 text-[12px] font-bold text-[#315C91] hover:bg-[#EDF3FA]">Refresh</button>
      </div>
      {alerts.length === 0 ? (
        <p className="mt-4 text-[14px] text-[#667085]">Booking confirmations and calendar changes will appear here.</p>
      ) : (
        <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto">
          {alerts.map((alert) => (
            <div key={alert.id} className={`flex flex-col justify-between gap-3 rounded-[13px] border p-4 sm:flex-row sm:items-start ${alert.read_at ? "border-[#E4E7EC] bg-[#F8FAFC]" : "border-[#B9D4F2] bg-[#EDF3FA]"}`}>
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-[#101828]">{alert.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-[#475467]">{alert.body}</p>
                <p className="mt-2 text-[11px] text-[#667085]">{new Date(alert.created_at).toLocaleString("en-CA")}</p>
              </div>
              {!alert.read_at && <button type="button" onClick={() => void markRead(alert.id)} className="shrink-0 rounded-[11px] bg-white px-3 py-2 text-[12px] font-bold text-[#315C91]">Mark read</button>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
