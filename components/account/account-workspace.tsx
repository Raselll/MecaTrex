"use client";

import { useEffect, useState, type ReactNode } from "react";
import SuccessToasts from "./success-toasts";
import BookingNotifications from "@/components/booking/booking-notifications";

type Section = "overview" | "appointments" | "calendar" | "business" | "services" | "settings" | "earnings" | "finances" | "towing";

type Props = {
  kind: "client" | "provider";
  userId: string;
  firstName: string;
  approved?: boolean;
  providerType?: "garage" | "towing";
  towingRequests?: ReactNode;
  overview?: ReactNode;
  appointments?: ReactNode;
  calendar?: ReactNode;
  financials?: ReactNode;
  providerDashboard?: ReactNode;
  settings: ReactNode;
};

const descriptions: Record<Section, string> = {
  overview: "Everything important, at a glance.",
  appointments: "Your upcoming and previous appointments.",
  calendar: "Your availability, bookings and opening hours.",
  earnings: "Understand past booking value and upcoming estimated revenue.",
  finances: "Explore monthly service costs and upcoming appointments.",
  towing: "Claim available towing requests and track your assigned jobs.",
  business: "Your public listing, contact details and photo.",
  services: "Manage every service, duration and fixed price.",
  settings: "Your personal information and dashboard preferences.",
};

const titles: Record<Section, string> = {
  overview: "Overview",
  appointments: "My appointments",
  calendar: "Calendar & availability",
  earnings: "Finances",
  finances: "Finances",
  towing: "Towing jobs",
  business: "Business profile",
  services: "Services & prices",
  settings: "Settings",
};

const symbols: Record<Section, string> = {
  overview: "⌂",
  appointments: "▦",
  calendar: "▦",
  earnings: "▥",
  finances: "$",
  towing: "🚛",
  business: "▣",
  services: "⚒",
  settings: "⚙",
};

export default function AccountWorkspace({
  kind,
  userId,
  firstName,
  approved = false,
  providerType = "garage",
  towingRequests,
  overview,
  appointments,
  calendar,
  financials,
  providerDashboard,
  settings,
}: Props) {
  const [view, setView] = useState<Section>("overview");

  // Directly open the appointment tab after a successful booking.
  // Keep the server and client initial state consistent, then read the URL
  // only after hydration to prevent mismatches.
  useEffect(() => {
    if (kind !== "client") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "appointments" || params.has("booked")) {
      setView("appointments");
    }
  }, [kind]);

  const sections: Section[] = kind === "client"
    ? ["overview", "appointments", "finances"]
    : approved ? ["overview", "calendar", ...(towingRequests ? ["towing" as const] : []), "earnings", "business"] : ["overview"];

  const navigationLabels: Partial<Record<Section, string>> = {
    appointments: "My bookings",
    calendar: "Calendar",
    business: "Business setup",
    settings: "My account",
  };
  const activeSection = view === "services" ? "business" : view;
  const subSections: Section[] = kind === "provider" && approved && activeSection === "business" ? ["business","services"] : [];

  useEffect(() => {
    function openAnchor() {
      if (kind !== "provider") return;
      const hash = window.location.hash;
      if (hash === "#application-status") setView("overview");
      if (!approved) return;
      if (hash === "#business-profile") setView("business");
      if (hash === "#services") setView("services");
    }
    openAnchor();
    window.addEventListener("hashchange", openAnchor);
    return () => window.removeEventListener("hashchange", openAnchor);
  }, [kind, approved]);

  function goTo(next: Section) {
    setView(next);
    // Preserve the forms in mounted panels; only the visible workspace changes.
    window.requestAnimationFrame(() => {
      document.getElementById("mecatrex-workspace-top")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <div id="mecatrex-workspace-top" className="mt-7 scroll-mt-24">
      <SuccessToasts/>
      <div className="rounded-[20px] border border-[#E7E5E2] bg-[#F7F8FA] lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="border-b border-[#DCE5EF] bg-white p-3 lg:border-b-0 lg:border-r lg:p-4 lg:sticky lg:top-4 lg:self-start">
          <div className="hidden lg:block">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#FF5B13]">My workspace</p>
            <p className="mt-2 truncate text-[17px] font-extrabold text-[#101828]">{firstName}</p>
            <p className="mt-1 text-[12px] text-[#667085]">
              {kind === "provider" ? "Business account" : "Personal account"}
            </p>
          </div>

          <nav aria-label="Account sections" className="flex gap-1.5 overflow-x-auto pb-1 lg:mt-7 lg:flex-col lg:overflow-visible">
            {sections.map((section) => {
              const active = activeSection === section;
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => goTo(section)}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] px-3 py-3 text-left text-[13px] font-bold transition lg:w-full " +
                    (active
                      ? "bg-[#FFF1E8] text-[#B33D00]"
                      : "text-[#475467] hover:bg-[#F2F5FA] hover:text-[#101828]")
                  }
                >
                  <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-white/70 text-[17px]">{symbols[section]}</span>
                  {navigationLabels[section] ?? titles[section]}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4 p-3 sm:p-5">
          <header className="mb-6 flex items-start justify-between gap-3 border-b border-[#E4EAF1] pb-5">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#FF5B13]">
                {kind === "provider" ? (providerType === "towing" ? "Towing workspace" : "Garage workspace") : "Client workspace"}
              </p>
              <h2 className="mt-1.5 text-[25px] font-extrabold tracking-tight text-[#101828] sm:text-[31px]">{navigationLabels[activeSection] ?? titles[activeSection]}</h2>
              <p className="mt-1 text-[12px] leading-5 text-[#667085]">{descriptions[view]}</p>
            </div>
            <BookingNotifications userId={userId} />
          </header>

          {subSections.length > 1 && (
            <nav aria-label="Workspace subsections" className="mb-6 flex flex-wrap gap-2 border-b border-[#EAECF0] pb-3">
              {subSections.map((section) => (
                <button key={section} type="button" aria-current={view === section ? "page" : undefined} onClick={() => goTo(section)} className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition ${view === section ? "bg-[#FFF1E8] text-[#D6531B]" : "text-[#475467] hover:bg-[#F2F4F7]"}`}>
                  {section === "earnings" ? "Business finances" : section === "appointments" ? "Appointments" : section === "calendar" ? "Calendar & availability" : titles[section]}
                </button>
              ))}
            </nav>
          )}

          <div hidden={view !== "overview"} className="workspace-content">
            {overview}
          </div>

          <div hidden={view !== "appointments"} className="workspace-content">
            {appointments}
          </div>

          <div hidden={view !== "calendar"} className="workspace-content">
            {calendar}
          </div>

          {financials && (
            <div
              hidden={view !== (kind === "provider" ? "earnings" : "finances")}
              className="workspace-content"
            >
              {financials}
            </div>
          )}

          {towingRequests && (
            <div hidden={view !== "towing"} className="workspace-content">
              {towingRequests}
            </div>
          )}

          {providerDashboard && (
            <div
              hidden={!["overview", "business", "services"].includes(view)}
              className="workspace-content provider-workspace-board"
              data-provider-view={view}
            >
              {providerDashboard}
            </div>
          )}

          <div hidden={view !== "overview"} className="workspace-content">
            {settings}
          </div>
        </div>
      </div>

      <style>{`
        .workspace-content[hidden] { display: none !important; }
        .provider-workspace-board[data-provider-view="overview"] #business-profile,
        .provider-workspace-board[data-provider-view="overview"] #services,
        .provider-workspace-board[data-provider-view="overview"] .provider-save-toolbar,
        .provider-workspace-board[data-provider-view="business"] #application-status,
        .provider-workspace-board[data-provider-view="business"] #services,
        .provider-workspace-board[data-provider-view="services"] #application-status,
        .provider-workspace-board[data-provider-view="services"] #business-profile {
          display: none !important;
        }
        .provider-workspace-board[data-provider-view="overview"] > .provider-dashboard-compact > div {
          margin-top: 0 !important;
        }
        .provider-workspace-board .provider-save-toolbar {
          position: relative !important;
          top: auto !important;
          z-index: 1 !important;
          box-shadow: none !important;
        }
        .provider-workspace-board #business-profile {
          align-items: start !important;
          grid-template-columns: minmax(0, 1fr) !important;
        }
        @media (min-width: 1200px) {
          .provider-workspace-board #business-profile {
            grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr) !important;
          }
        }
        .provider-workspace-board #business-profile > section:first-child {
          min-height: 0 !important;
        }
      `}</style>
    </div>
  );
}
