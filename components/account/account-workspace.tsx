"use client";

import { useState, type ReactNode } from "react";
import BookingNotifications from "@/components/booking/booking-notifications";

type Section = "overview" | "appointments" | "calendar" | "business" | "services" | "settings" | "earnings" | "finances";

type Props = {
  kind: "client" | "provider";
  userId: string;
  firstName: string;
  approved?: boolean;
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
  business: "Your public listing, contact details and photo.",
  services: "Manage every service, duration and fixed price.",
  settings: "Your personal information and dashboard preferences.",
};

const titles: Record<Section, string> = {
  overview: "Overview",
  appointments: "My appointments",
  calendar: "Calendar & availability",
  earnings: "Business",
  finances: "Finances",
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
  business: "▣",
  services: "⚒",
  settings: "⚙",
};

export default function AccountWorkspace({
  kind,
  userId,
  firstName,
  approved = false,
  overview,
  appointments,
  calendar,
  financials,
  providerDashboard,
  settings,
}: Props) {
  const [view, setView] = useState<Section>("overview");
  const sections: Section[] =
    kind === "client"
      ? ["overview", "appointments", "finances", "settings"]
      : approved
        ? ["overview", "calendar", "earnings", "business", "services", "settings"]
        : ["overview", "settings"];

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
      <div className="overflow-hidden rounded-[25px] border border-[#DCE5EF] bg-[#F7F9FC] shadow-[0_16px_42px_rgba(16,24,40,0.05)] lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="border-b border-[#DCE5EF] bg-white p-3 lg:border-b-0 lg:border-r lg:p-5">
          <div className="hidden lg:block">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4771A6]">My workspace</p>
            <p className="mt-2 truncate text-[17px] font-extrabold text-[#101828]">{firstName}</p>
            <p className="mt-1 text-[12px] text-[#667085]">
              {kind === "provider" ? "Business account" : "Personal account"}
            </p>
          </div>

          <nav aria-label="Account sections" className="flex gap-1.5 overflow-x-auto pb-1 lg:mt-7 lg:flex-col lg:overflow-visible">
            {sections.map((section) => {
              const active = view === section;
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => goTo(section)}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[12px] px-4 py-3 text-left text-[13px] font-bold transition lg:w-full " +
                    (active
                      ? "bg-[#E8F0FA] text-[#244F83] shadow-sm"
                      : "text-[#475467] hover:bg-[#F2F5FA] hover:text-[#101828]")
                  }
                >
                  <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-white/70 text-[17px]">{symbols[section]}</span>
                  {titles[section]}
                </button>
              );
            })}
          </nav>
          <div className="mt-8 hidden rounded-[14px] bg-[#EFF5FC] p-4 lg:block">
            <p className="text-[12px] font-bold text-[#244F83]">MECATREX</p>
            <p className="mt-1 text-[11px] leading-5 text-[#667085]">
              {kind === "provider"
                ? "Keep your services and schedule up to date."
                : "Compare garages and book in just a few clicks."}
            </p>
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex items-start justify-between gap-3 border-b border-[#E4EAF1] pb-5">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#4771A6]">
                {kind === "provider" ? "Garage workspace" : "Client workspace"}
              </p>
              <h2 className="mt-1.5 text-[25px] font-extrabold tracking-tight text-[#101828] sm:text-[31px]">{titles[view]}</h2>
              <p className="mt-1 text-[12px] leading-5 text-[#667085]">{descriptions[view]}</p>
            </div>
            <BookingNotifications userId={userId} />
          </header>

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

          {providerDashboard && (
            <div
              hidden={!["overview", "business", "services"].includes(view)}
              className="workspace-content provider-workspace-board"
              data-provider-view={view}
            >
              {providerDashboard}
            </div>
          )}

          <div hidden={view !== "settings"} className="workspace-content">
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
