import Link from "next/link";

const days = ["MON 09", "TUE 10", "WED 11", "THU 12", "FRI 13"];

export default function GarageDashboardStory() {
  return (
    <section className="bw-dashboard-story" aria-labelledby="bw-dashboard-heading">
      <div className="bw-shell">
        <div className="bw-dashboard-story-heading">
          <span className="bw-eyebrow">FOR THE PEOPLE BEHIND THE GARAGE</span>
          <h2 id="bw-dashboard-heading">A clearer view of<br /><span>every appointment.</span></h2>
          <p>Less guesswork, more structure. Give your team a simple view of the week, manage unavailable time and keep bookings organized in one place.</p>
          <Link href="/signup" className="bw-dashboard-story-link">Explore BandWhip for garages <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="bw-dashboard-perspective">
          <div className="bw-dashboard-window">
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
