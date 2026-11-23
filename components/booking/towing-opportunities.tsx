"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMontrealDateTime } from "@/lib/booking";

type Job = {
  request_id: string;
  booking_id: string;
  appointment_at: string;
  garage_name: string;
  garage_address: string;
  service_name: string;
  pickup_address: string;
  client_name: string;
  client_phone: string;
  towing_note: string;
  request_status: "pending" | "accepted" | "cancelled";
  accepted_by_me: boolean;
};

export default function TowingOpportunities({
  scheduleOnly = false,
}: {
  scheduleOnly?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [view, setView] = useState<"pending" | "accepted">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc(
      "list_my_towing_opportunities"
    );
    if (loadError) {
      setError(
        loadError.code === "PGRST202"
          ? "Towing dispatch has not been enabled in Supabase yet. The new towing migration must be applied."
          : loadError.message
      );
    } else {
      setJobs((data ?? []) as Job[]);
      setError("");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function accept(job: Job) {
    if (!window.confirm(
      "Accept this towing job? Other towing providers will no longer be able to claim it. You must coordinate pickup details with the client."
    )) return;
    setBusyId(job.request_id);
    setError("");
    setNotice("");
    const { error: claimError } = await supabase.rpc("accept_towing_request", {
      p_request_id: job.request_id,
    });
    setBusyId("");
    if (claimError) {
      setError(claimError.message);
      await load();
      return;
    }
    setNotice("Job accepted. You can now view the client's contact details below.");
    setView("accepted");
    await load();
  }

  const pending = jobs.filter((job) => job.request_status === "pending");
  const accepted = jobs.filter(
    (job) => job.request_status === "accepted" && job.accepted_by_me
  );
  const visible = scheduleOnly ? accepted : view === "pending" ? pending : accepted;

  return (
    <section className="rounded-[24px] border border-[#CBD9E8] bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">
            {scheduleOnly ? "Your towing calendar" : "Towing dispatch"}
          </p>
          <h3 className="mt-2 text-[24px] font-extrabold text-[#101828]">
            {scheduleOnly ? "Assigned towing jobs" : "Towing opportunities"}
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-[#667085]">
            {scheduleOnly
              ? "Accepted jobs appear here by garage appointment date. Coordinate a separate pickup time with each client."
              : "View nearby requests and claim an available towing job. Garage appointments remain confirmed while towing is pending."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); void load(); }}
          className="rounded-xl border border-[#CBD9E8] bg-[#F7FAFD] px-4 py-2.5 text-[12px] font-bold text-[#315C91] hover:bg-[#EDF3FA]"
        >
          ↻ Refresh
        </button>
      </div>

      {!scheduleOnly && (
        <div className="mt-5 flex flex-wrap gap-2 border-b border-[#E4EAF1] pb-4">
          <button type="button" onClick={() => setView("pending")}
            aria-pressed={view === "pending"}
            className={"rounded-xl px-4 py-2.5 text-[13px] font-bold " +
              (view === "pending" ? "bg-[#4771A6] text-white" : "bg-[#F3F6FA] text-[#475467]")}>
            Available ({pending.length})
          </button>
          <button type="button" onClick={() => setView("accepted")}
            aria-pressed={view === "accepted"}
            className={"rounded-xl px-4 py-2.5 text-[13px] font-bold " +
              (view === "accepted" ? "bg-[#4771A6] text-white" : "bg-[#F3F6FA] text-[#475467]")}>
            My accepted jobs ({accepted.length})
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-4 rounded-xl bg-[#FEF3F2] p-4 text-[13px] text-[#B42318]">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-[#ECFDF3] p-4 text-[13px] text-[#05603A]">{notice}</p>}

      {loading ? (
        <p className="mt-5 text-[13px] text-[#667085]">Checking towing requests…</p>
      ) : visible.length === 0 ? (
        <div className="mt-5 rounded-[17px] bg-[#F7FAFD] p-6 text-center">
          <p className="text-[15px] font-bold text-[#344054]">
            {scheduleOnly || view === "accepted" ? "No assigned jobs yet" : "No available towing requests right now"}
          </p>
          <p className="mt-2 text-[12px] text-[#667085]">
            {scheduleOnly || view === "accepted"
              ? "Once you accept a request, it will appear here."
              : "Only future garage appointments in your company's province are offered."}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {visible.map((job) => (
            <article key={job.request_id} className="rounded-[17px] border border-[#D6E1ED] bg-[#FAFCFF] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#4771A6]">
                    🚛 {job.request_status === "accepted" ? "Accepted towing job" : "Open request"}
                  </p>
                  <h4 className="mt-1 text-[17px] font-extrabold text-[#101828]">
                    {job.garage_name}
                  </h4>
                  <p className="mt-2 text-[13px] font-bold text-[#344054]">
                    📅 {formatMontrealDateTime(job.appointment_at)}
                  </p>
                  <p className="mt-1 text-[12px] text-[#667085]">
                    Appointment time · arrange towing pickup before this time
                  </p>
                </div>
                <span className={"rounded-full px-3 py-1.5 text-[11px] font-bold " +
                  (job.request_status === "accepted"
                    ? "bg-[#ECFDF3] text-[#027A48]"
                    : "bg-[#FFF3E4] text-[#9A4D10]")}>
                  {job.request_status === "accepted" ? "Accepted" : "Available"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 rounded-[13px] border border-[#E2E9F1] bg-white p-4 text-[12px] text-[#475467] sm:grid-cols-2">
                <div>
                  <p className="font-extrabold text-[#344054]">Pickup address</p>
                  <p className="mt-1 whitespace-pre-wrap">{job.pickup_address}</p>
                </div>
                <div>
                  <p className="font-extrabold text-[#344054]">Destination garage</p>
                  <p className="mt-1">{job.garage_address}</p>
                </div>
              </div>
              {job.towing_note && (
                <p className="mt-3 whitespace-pre-wrap text-[12px] text-[#667085]">
                  <strong>Client notes:</strong> {job.towing_note}
                </p>
              )}
              {job.request_status === "accepted" ? (
                <div className="mt-4 rounded-[13px] bg-[#EDF7F2] p-4 text-[13px] text-[#05603A]">
                  <strong>Customer:</strong> {job.client_name}
                  {job.client_phone && (
                    <> · <a className="font-bold underline" href={"tel:" + job.client_phone.replace(/[^\d+]/g, "")}>{job.client_phone}</a></>
                  )}
                  <p className="mt-2 text-[12px]">
                    Contact the client to confirm pickup time and towing cost. Towing payments are not yet processed by MECATREX.
                  </p>
                </div>
              ) : (
                <button type="button" disabled={busyId === job.request_id}
                  onClick={() => void accept(job)}
                  className="mt-4 rounded-[13px] bg-[#4771A6] px-5 py-3 text-[13px] font-bold text-white hover:bg-[#315C91] disabled:opacity-50">
                  {busyId === job.request_id ? "Accepting…" : "✓ Accept this towing job"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
