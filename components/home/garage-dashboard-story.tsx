"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const days = ["MON 09", "TUE 10", "WED 11", "THU 12", "FRI 13"];

export default function GarageDashboardStory() {
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anchor = scrollAnchorRef.current;
    const dashboard = dashboardRef.current;
    if (!anchor || !dashboard) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;

    const updatePerspective = () => {
      raf = 0;
      if (reducedMotion.matches) {
        dashboard.style.removeProperty("--bw-dashboard-angle");
        dashboard.style.removeProperty("--bw-dashboard-scale");
        dashboard.style.removeProperty("--bw-dashboard-lift");
        return;
      }

      // Measure the stationary wrapper; reading the transformed dashboard
      // would make scroll progress change as the animation itself moves.
      const { top } = anchor.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;

      // Starts nearly flat when entering at the bottom of the viewport;
      // stands upright when the top reaches the upper quarter of the screen.
      const start = viewportHeight * 0.99;
      const finish = viewportHeight * 0.24;
      const progress = Math.min(1, Math.max(0, (start - top) / (start - finish)));
      const eased = progress * progress * (3 - 2 * progress);

      dashboard.style.setProperty("--bw-dashboard-angle", `${(72 * (1 - eased)).toFixed(2)}deg`);
      dashboard.style.setProperty("--bw-dashboard-scale", (0.80 + 0.20 * eased).toFixed(4));
      dashboard.style.setProperty("--bw-dashboard-lift", `${(112 * (1 - eased)).toFixed(1)}px`);
    };

    const requestUpdate = () => {
      if (!raf) raf = window.requestAnimationFrame(updatePerspective);
    };

    updatePerspective();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    reducedMotion.addEventListener("change", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      reducedMotion.removeEventListener("change", requestUpdate);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="bw-dashboard-story" style={{ background: "transparent" }} aria-labelledby="bw-dashboard-heading">
      <div className="bw-shell">
        <div className="bw-dashboard-story-heading">
          <span className="bw-eyebrow">FOR THE PEOPLE BEHIND THE GARAGE</span>
          <h2 id="bw-dashboard-heading">A clearer view of<br /><span>every appointment.</span></h2>
          <p>Less guesswork, more structure. Give your team a simple view of the week, manage unavailable time and keep bookings organized in one place.</p>
          <Link href="/signup" className="bw-dashboard-story-link">Explore BandWhip for garages <span aria-hidden="true">↗</span></Link>
        </div>
        <div ref={scrollAnchorRef} className="bw-dashboard-perspective">
          <div ref={dashboardRef} className="bw-dashboard-window">
            <div className="bw-dashboard-window-top"><div className="bw-dashboard-window-dots"><i /><i /><i /></div><span>BandWhip / Garage workspace</span><span className="bw-dashboard-demo-label">ILLUSTRATIVE PREVIEW</span></div>
            <div className="bw-dashboard-app">
              <aside className="bw-dashboard-sidebar"><span className="bw-dashboard-small-logo">B</span><strong>Workspace</strong><span className="is-active">▦ <span>Calendar</span></span><span>◫ <span>Bookings</span></span><span>◷ <span>Availability</span></span><span>≡ <span>Services</span></span><div className="bw-sidebar-help">✦ <span>Stay organized</span></div></aside>
              <div className="bw-dashboard-content">
                <div className="bw-dashboard-top"><div><small>ATELIER CENTRAL / MONTRÉAL</small><h3>Weekly overview</h3><p>Your bookings and available hours, in one place.</p></div><span>‹ &nbsp; November 2026 &nbsp; ›</span></div>
                <div className="bw-dashboard-summary"><div><span>Confirmed appointments</span><strong>18</strong><small>This week</small></div><div><span>Hours scheduled</span><strong>36h</strong><small>Across available slots</small></div><div><span>Next appointment</span><strong>10:30</strong><small>Wednesday morning</small></div></div>
                <div className="bw-dashboard-table"><div className="bw-dashboard-table-head"><span>TIME</span>{days.map(day=><span key={day}>{day}</span>)}</div>
                  {["09:00", "10:30", "13:00", "14:30"].map((time,row)=><div className="bw-dashboard-table-row" key={time}><span className="bw-dashboard-hour">{time}</span>{days.map((day,col)=>{const filled=(row+col)%3!==1;return <span key={day} className={filled?"bw-dashboard-slot is-booked":"bw-dashboard-slot"}>{filled?(row===0?"Oil change":row===1?"Tire service":row===2?"Inspection":"Appointment"):"Available"}</span>})}</div>)}
                </div>
                <p className="bw-dashboard-caption">Example schedule and metrics — no real business data.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
