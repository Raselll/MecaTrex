"use client";

import { useEffect, useState } from "react";

const steps = [
  { id: "service", label: "Service", eyebrow: "01 / CHOOSE A SERVICE", title: "What does your car need?", description: "Start with the service that fits your vehicle." },
  { id: "garage", label: "Garage", eyebrow: "02 / COMPARE YOUR OPTIONS", title: "Find the right garage.", description: "Compare listed services and choose a local provider." },
  { id: "schedule", label: "Schedule", eyebrow: "03 / PICK YOUR TIME", title: "Your time. Your choice.", description: "See available appointments before you book." },
  { id: "confirmed", label: "Confirmed", eyebrow: "04 / YOU'RE BOOKED", title: "And just like that.", description: "Your appointment is confirmed without a callback." },
  { id: "review", label: "Review", eyebrow: "05 / AFTER YOUR VISIT", title: "Share your experience.", description: "Leave a review after your service is complete." },
  { id: "payment", label: "Payments", eyebrow: "06 / FUTURE EXPERIENCE", title: "One place for everything.", description: "A preview of an optional future payment experience." },
] as const;

const serviceChoices = [
  ["01", "Oil change", "Routine maintenance"],
  ["02", "Tire change", "Seasonal service"],
  ["03", "Vehicle inspection", "A closer look"],
];

export default function BookingPhoneShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % steps.length), 4300);
    return () => window.clearInterval(timer);
  }, [paused]);

  const step = steps[active];
  const select = (index: number) => setActive(index);

  return (
    <section id="mobile-experience" className="bw-mobile-story" aria-labelledby="bw-mobile-heading">
      <div className="bw-shell bw-mobile-story-grid">
        <div className="bw-mobile-story-copy">
          <span className="bw-eyebrow">YOUR GARAGE, IN YOUR POCKET</span>
          <h2 id="bw-mobile-heading">Less calling.<br /><span>More going.</span></h2>
          <p>From finding the service you need to reserving your time, BandWhip brings the whole experience together. Simple on desktop, just as intuitive on your phone.</p>
          <div className="bw-phone-steps" role="group" aria-label="Preview the booking experience">
            {steps.map((item, index) => (
              <button key={item.id} type="button" className={index === active ? "is-current" : ""} aria-pressed={index === active} onClick={() => select(index)}>
                <span className="bw-phone-step-no">{String(index + 1).padStart(2, "0")}</span>
                <span>{item.label}</span>
                {index === active && <span aria-hidden="true" className="bw-phone-step-arrow">↗</span>}
              </button>
            ))}
          </div>
          <div className="bw-phone-note"><span className="bw-pulse" /> Interactive product illustration — not a live booking or payment screen.</div>
        </div>
        <div className="bw-phone-stage" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}>
          <div className="bw-phone-stage-ring" aria-hidden="true" />
          <div className="bw-phone-side-card bw-phone-side-left" aria-hidden="true"><span>01</span><strong>Find your service.</strong><small>Easy from the start</small></div>
          <div className="bw-phone-side-card bw-phone-side-right" aria-hidden="true"><span>✓</span><strong>You&apos;re booked.</strong><small>Without the phone calls</small></div>
          <div className="bw-phone-device">
            <div className="bw-phone-bezel">
              <div className="bw-phone-island" aria-hidden="true" />
              <div className="bw-phone-topbar"><span>9:41</span><span className="bw-phone-status-icons">●  ▰</span></div>
              <div className="bw-phone-app">
                <div className="bw-phone-app-nav"><span className="bw-phone-app-brand"><span className="bw-phone-mark">B</span> BandWhip</span><span className="bw-phone-avatar">JD</span></div>
                <div key={step.id} className="bw-phone-screen">
                  <span className="bw-phone-eyebrow">{step.eyebrow}</span>
                  <h3>{step.title}</h3>
                  <p className="bw-phone-description">{step.description}</p>

                  {step.id === "service" && <div className="bw-phone-choice-list">
                    {serviceChoices.map(([number, name, sub], i) => <div key={name} className={i === 0 ? "is-selected" : ""}><span>{number}</span><div><strong>{name}</strong><small>{sub}</small></div><b>{i === 0 ? "✓" : "↗"}</b></div>)}
                  </div>}

                  {step.id === "garage" && <div className="bw-phone-choice-list bw-phone-garages">
                    {[["Atelier Central", "Montréal · From $79", "4.8"], ["Garage du Parc", "Montréal · From $89", "4.7"], ["Auto Service Local", "Montréal · From $95", "4.9"]].map(([name, sub, rating], i) => <div key={name} className={i === 0 ? "is-selected" : ""}><span className="bw-phone-garage-icon">{String(i + 1).padStart(2, "0")}</span><div><strong>{name}</strong><small>{sub}</small></div><b>★ {rating}</b></div>)}
                  </div>}

                  {step.id === "schedule" && <div className="bw-phone-schedule">
                    <span className="bw-phone-group-label">NOVEMBER 2026</span>
                    <div className="bw-phone-days">{[["MO","09"],["TU","10"],["WE","11"],["TH","12"],["FR","13"]].map(([day,date])=><div key={day} className={date==="11"?"is-selected":""}><small>{day}</small><strong>{date}</strong></div>)}</div>
                    <span className="bw-phone-group-label">AVAILABLE TIMES</span>
                    <div className="bw-phone-slots"><span>9:00 AM</span><span className="is-selected">10:30 AM</span><span>1:00 PM</span><span>3:30 PM</span></div>
                  </div>}

                  {step.id === "confirmed" && <div className="bw-phone-confirmed"><div className="bw-phone-success-mark">✓</div><strong>Your appointment<br />is confirmed.</strong><p>Wednesday, November 11<br />10:30 AM · Atelier Central</p><div>Booking confirmed <span>✓</span></div></div>}

                  {step.id === "review" && <div className="bw-phone-review"><div className="bw-phone-review-icon">✦</div><strong>How was your visit?</strong><small>Your feedback helps other drivers.</small><div className="bw-phone-stars" aria-label="Five stars">★★★★★</div><div className="bw-phone-review-box">Great service, friendly team...</div></div>}

                  {step.id === "payment" && <div className="bw-phone-payment"><span className="bw-phone-coming-soon">FUTURE FEATURE CONCEPT</span><div><small>Service total (illustrative)</small><strong>$89.00</strong></div><div className="bw-phone-payment-row"><span>Service</span><b>$89.00</b></div><div className="bw-phone-payment-row"><span>Taxes</span><b>Calculated at checkout</b></div><p>Online payments are not available on BandWhip yet.</p></div>}
                </div>
                <div className="bw-phone-app-bottom"><span>{step.id === "payment" ? "Concept preview" : step.id === "confirmed" ? "View your booking" : step.id === "review" ? "Submit review (preview)" : "Continue"} <span>↗</span></span></div>
              </div>
              <div className="bw-phone-home-indicator" aria-hidden="true" />
            </div>
          </div>
          <div className="bw-phone-controls"><button type="button" aria-label="Previous screen" onClick={() => select((active - 1 + steps.length) % steps.length)}>‹</button><span>{String(active + 1).padStart(2, "0")} <span>/ {String(steps.length).padStart(2, "0")}</span></span><button type="button" aria-label="Next screen" onClick={() => select((active + 1) % steps.length)}>›</button></div>
        </div>
      </div>
    </section>
  );
}
