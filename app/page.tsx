"use client";

import BrandLogo from "@/components/brand/bandwhip-logo";
import Script from "next/script";
import Link from "next/link";
import LiveGarages from "@/components/home/live-garages";
import HomeAuthActions from "@/components/home/home-auth-actions";
import WhenPicker from "@/components/home/when-picker";
import { SERVICE_CATALOGUE } from "@/lib/service-listing";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Vehicle = {
  year: string;
  make: string;
  model: string;
  color?: string;
};

const VEHICLE_STORAGE_KEY = "mecatrex-selected-vehicle";

const CAR_IMAGES_API_KEY =
  process.env.NEXT_PUBLIC_CAR_IMAGES_API_KEY ?? "";

const years = Array.from(
  { length: 38 },
  (_, index) => String(2027 - index)
);

const makes = [
  "Acura",
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Mazda",
  "Mercedes-Benz",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Porsche",
  "Ram",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const vehicleColors = [
  "Black",
  "White",
  "Silver",
  "Grey",
  "Blue",
  "Red",
  "Green",
  "Brown",
  "Beige",
  "Gold",
  "Orange",
  "Yellow",
  "Purple",
  "Other",
];

const colorSwatches: Record<string, string> = {
  Black: "#111827",
  White: "#FFFFFF",
  Silver: "#C0C5CC",
  Grey: "#667085",
  Blue: "#FF5B13",
  Red: "#D92D20",
  Green: "#2F855A",
  Brown: "#7C4A32",
  Beige: "#D9C6A5",
  Gold: "#C89B3C",
  Orange: "#E97827",
  Yellow: "#EAB308",
  Purple: "#7F56D9",
  Other: "#D0D5DD",
};

const modelsByMake: Record<string, string[]> = {
  Acura: [
    "Integra",
    "TLX",
    "RDX",
    "MDX",
  ],

  Audi: [
    "A3",
    "A4",
    "A5",
    "A6",
    "A7",
    "A8",
    "Q3",
    "Q5",
    "Q7",
    "Q8",
  ],

  BMW: [
    "2 Series",
    "3 Series",
    "4 Series",
    "5 Series",
    "7 Series",
    "X1",
    "X2",
    "X3",
    "X4",
    "X5",
    "X6",
    "X7",
  ],

  Buick: [
    "Encore",
    "Encore GX",
    "Envision",
    "Enclave",
  ],

  Cadillac: [
    "CT4",
    "CT5",
    "XT4",
    "XT5",
    "XT6",
    "Escalade",
  ],

  Chevrolet: [
    "Malibu",
    "Trax",
    "Trailblazer",
    "Equinox",
    "Blazer",
    "Traverse",
    "Tahoe",
    "Suburban",
    "Silverado",
  ],

  Chrysler: [
    "300",
    "Pacifica",
  ],

  Dodge: [
    "Charger",
    "Challenger",
    "Durango",
    "Hornet",
  ],

  Ford: [
    "Mustang",
    "Escape",
    "Bronco Sport",
    "Bronco",
    "Edge",
    "Explorer",
    "F-150",
    "Maverick",
  ],

  Genesis: [
    "G70",
    "G80",
    "G90",
    "GV60",
    "GV70",
    "GV80",
  ],

  GMC: [
    "Terrain",
    "Acadia",
    "Yukon",
    "Canyon",
    "Sierra",
  ],

  Honda: [
    "Civic",
    "Accord",
    "HR-V",
    "CR-V",
    "Passport",
    "Pilot",
    "Ridgeline",
    "Odyssey",
  ],

  Hyundai: [
    "Elantra",
    "Sonata",
    "Venue",
    "Kona",
    "Tucson",
    "Santa Fe",
    "Palisade",
    "Ioniq 5",
  ],

  Infiniti: [
    "Q50",
    "QX50",
    "QX55",
    "QX60",
    "QX80",
  ],

  Jeep: [
    "Compass",
    "Cherokee",
    "Grand Cherokee",
    "Wrangler",
    "Gladiator",
    "Wagoneer",
  ],

  Kia: [
    "Forte",
    "K4",
    "K5",
    "Soul",
    "Seltos",
    "Sportage",
    "Sorento",
    "Telluride",
    "EV6",
  ],

  "Land Rover": [
    "Discovery Sport",
    "Discovery",
    "Defender",
    "Range Rover Evoque",
    "Range Rover Sport",
    "Range Rover",
  ],

  Lexus: [
    "IS",
    "ES",
    "UX",
    "NX",
    "RX",
    "GX",
    "TX",
    "LX",
  ],

  Lincoln: [
    "Corsair",
    "Nautilus",
    "Aviator",
    "Navigator",
  ],

  Mazda: [
    "Mazda3",
    "CX-30",
    "CX-5",
    "CX-50",
    "CX-70",
    "CX-90",
    "MX-5",
  ],

  "Mercedes-Benz": [
    "A-Class",
    "C-Class",
    "E-Class",
    "S-Class",
    "GLA",
    "GLB",
    "GLC",
    "GLE",
    "GLS",
  ],

  MINI: [
    "Cooper",
    "Countryman",
  ],

  Mitsubishi: [
    "Mirage",
    "RVR",
    "Outlander",
    "Outlander PHEV",
  ],

  Nissan: [
    "Sentra",
    "Altima",
    "Kicks",
    "Rogue",
    "Murano",
    "Pathfinder",
    "Frontier",
  ],

  Porsche: [
    "718",
    "911",
    "Macan",
    "Cayenne",
    "Panamera",
    "Taycan",
  ],

  Ram: [
    "1500",
    "2500",
    "3500",
  ],

  Subaru: [
    "Impreza",
    "Legacy",
    "Crosstrek",
    "Forester",
    "Outback",
    "Ascent",
    "WRX",
  ],

  Tesla: [
    "Model 3",
    "Model Y",
    "Model S",
    "Model X",
    "Cybertruck",
  ],

  Toyota: [
    "Corolla",
    "Camry",
    "Prius",
    "C-HR",
    "Corolla Cross",
    "RAV4",
    "Highlander",
    "4Runner",
    "Tacoma",
    "Tundra",
  ],

  Volkswagen: [
    "Jetta",
    "Golf",
    "Taos",
    "Tiguan",
    "Atlas",
    "ID.4",
  ],

  Volvo: [
    "S60",
    "S90",
    "XC40",
    "XC60",
    "XC90",
    "EX30",
    "EX90",
  ],
};

// Keep homepage and provider catalogue in sync (including service emojis).
const services = SERVICE_CATALOGUE.map((service) => ({
  title: service.name,
  description: service.description,
  icon: service.icon,
}));

/* ========================================================= */
/* CARIMAGESAPI 3D VIEWER */
/* ========================================================= */

function Vehicle3DViewer({
  year,
  make,
  model,
  color,
  loaderReady,
  loaderError,
}: {
  year: string;
  make: string;
  model: string;
  color: string;
  loaderReady: boolean;
  loaderError: boolean;
}) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const [
    stableVehicle,
    setStableVehicle,
  ] =
    useState<Vehicle | null>(null);

  const canLoad =
    year.trim().length === 4 &&
    make.trim().length >= 2 &&
    model.trim().length >= 1;

  useEffect(() => {
    if (!canLoad) {
      setStableVehicle(null);
      return;
    }

    const timer =
      window.setTimeout(() => {
        setStableVehicle({
          year: year.trim(),
          make: make.trim(),
          model: model.trim(),
          color:
            color.trim() ||
            undefined,
        });
      }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    year,
    make,
    model,
    color,
    canLoad,
  ]);

  useEffect(() => {
    if (
      !stableVehicle ||
      !loaderReady ||
      loaderError ||
      !CAR_IMAGES_API_KEY ||
      !containerRef.current
    ) {
      return;
    }

    const container =
      containerRef.current;

    container.innerHTML = "";

    const viewer =
      document.createElement(
        "model-viewer"
      );

    viewer.setAttribute(
      "data-ci-type",
      "car"
    );

    viewer.setAttribute(
      "data-ci-make",
      stableVehicle.make
    );

    viewer.setAttribute(
      "data-ci-model",
      stableVehicle.model
    );

    viewer.setAttribute(
      "data-ci-year",
      stableVehicle.year
    );

    viewer.setAttribute(
      "data-ci-view",
      "front34"
    );

    viewer.setAttribute(
      "data-ci-speed",
      "18"
    );

    viewer.setAttribute(
      "data-ci-light",
      "5"
    );

    viewer.setAttribute(
      "data-ci-backdrop",
      "#F6F8FB"
    );

    viewer.setAttribute(
      "camera-controls",
      ""
    );

    viewer.setAttribute(
      "auto-rotate",
      ""
    );

    viewer.setAttribute(
      "interaction-prompt",
      "none"
    );

    viewer.setAttribute(
      "shadow-intensity",
      "1"
    );

    viewer.setAttribute(
      "aria-label",
      `${stableVehicle.year} ${stableVehicle.make} ${stableVehicle.model} 3D model`
    );

    viewer.style.width = "100%";
    viewer.style.height = "100%";
    viewer.style.display = "block";
    viewer.style.background =
      "#F6F8FB";
    viewer.style.borderRadius =
      "24px";
    viewer.style.overflow =
      "hidden";

    container.appendChild(viewer);

    return () => {
      container.innerHTML = "";
    };
  }, [
    stableVehicle,
    loaderReady,
    loaderError,
  ]);

  if (!CAR_IMAGES_API_KEY) {
    return (
      <div className="flex min-h-[330px] flex-col items-center justify-center rounded-[26px] bg-[#F6F8FB] px-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF4ED] text-[25px]">
          ⚠️
        </div>

        <p className="mt-5 text-[18px] font-bold text-[#101828]">
          CarImagesAPI key missing
        </p>

        <p className="mt-2 max-w-[360px] text-[14px] leading-6 text-[#667085]">
          Add
          NEXT_PUBLIC_CAR_IMAGES_API_KEY
          to .env.local and restart the
          development server.
        </p>
      </div>
    );
  }

  if (!canLoad) {
    return (
      <div className="flex min-h-[330px] flex-col items-center justify-center rounded-[26px] bg-[#F6F8FB] px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white text-[32px] shadow-sm">
          🚙
        </div>

        <p className="mt-5 text-[19px] font-bold text-[#101828]">
          Your vehicle will appear here
        </p>

        <p className="mt-2 max-w-[330px] text-[15px] leading-6 text-[#667085]">
          Choose the year, make and model
          to see your car in 3D.
        </p>
      </div>
    );
  }

  if (loaderError) {
    return (
      <div className="flex min-h-[330px] flex-col items-center justify-center rounded-[26px] bg-[#F6F8FB] px-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF4ED] text-[25px]">
          ⚠️
        </div>

        <p className="mt-5 text-[18px] font-bold text-[#101828]">
          3D viewer unavailable
        </p>

        <p className="mt-2 max-w-[360px] text-[14px] leading-6 text-[#667085]">
          BandWhip could not load the
          CarImagesAPI viewer.
        </p>
      </div>
    );
  }

  if (
    !loaderReady ||
    !stableVehicle
  ) {
    return (
      <div className="flex min-h-[330px] flex-col items-center justify-center rounded-[26px] bg-[#F6F8FB]">
        <div className="h-12 w-12 animate-spin rounded-full border-[4px] border-[#DCE4EE] border-t-[#FF5B13]" />

        <p className="mt-5 text-[17px] font-bold text-[#101828]">
          Loading your vehicle…
        </p>

        <p className="mt-1 text-[14px] text-[#667085]">
          {year} {make} {model}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative min-h-[330px] overflow-hidden rounded-[26px] bg-[#F6F8FB]">
        <div className="pointer-events-none absolute left-5 top-5 z-20 rounded-full border border-[#E4E7EC] bg-white/90 px-3.5 py-2 text-[12px] font-bold text-[#475467] shadow-sm backdrop-blur-md">
          360° 3D
        </div>

        <div
          ref={containerRef}
          className="absolute inset-0"
        />

        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-4 py-2 text-[12px] font-semibold text-[#667085] shadow-sm backdrop-blur-md">
          Drag to rotate
        </div>
      </div>

      <div className="mt-3 text-center">
        <p className="text-[13px] font-semibold text-[#475467]">
          {stableVehicle.year}{" "}
          {stableVehicle.make}{" "}
          {stableVehicle.model}
        </p>

        {stableVehicle.color && (
          <div className="mt-1.5 flex items-center justify-center gap-2 text-[12px] text-[#98A2B3]">
            <span
              className="h-2.5 w-2.5 rounded-full border border-black/10"
              style={{
                background:
                  colorSwatches[
                    stableVehicle
                      .color
                  ] || "#D0D5DD",
              }}
            />

            {
              stableVehicle.color
            }
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================= */
/* VEHICLE MODAL */
/* ========================================================= */

function VehicleModal({
  open,
  vehicle,
  onClose,
  onSave,
  onClear,
  loaderReady,
  loaderError,
}: {
  open: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSave: (
    vehicle: Vehicle
  ) => void;
  onClear: () => void;
  loaderReady: boolean;
  loaderError: boolean;
}) {
  const [year, setYear] =
    useState("");

  const [make, setMake] =
    useState("");

  const [model, setModel] =
    useState("");

  const [color, setColor] =
    useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setYear(
      vehicle?.year ?? ""
    );

    setMake(
      vehicle?.make ?? ""
    );

    setModel(
      vehicle?.model ?? ""
    );

    setColor(
      vehicle?.color ?? ""
    );
  }, [open, vehicle]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape"
      ) {
        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        "";
    };
  }, [open, onClose]);

  const modelSuggestions =
    useMemo(() => {
      if (!make) {
        return [];
      }

      return (
        modelsByMake[make] ?? []
      );
    }, [make]);

  if (!open) {
    return null;
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanedYear =
      year.trim();

    const cleanedMake =
      make.trim();

    const cleanedModel =
      model.trim();

    const cleanedColor =
      color.trim();

    if (
      !cleanedYear ||
      !cleanedMake ||
      !cleanedModel
    ) {
      return;
    }

    onSave({
      year: cleanedYear,
      make: cleanedMake,
      model: cleanedModel,
      color:
        cleanedColor ||
        undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#101828]/60 px-5 py-8 backdrop-blur-sm"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="my-auto w-full max-w-[1040px] overflow-hidden rounded-[34px] bg-white shadow-[0_35px_120px_rgba(16,24,40,0.4)]">

        {/* BANDWHIP / EDITORIAL NAVIGATION */}
        <header className="bw-header">
          <div className="bw-shell bw-nav-inner">
            <BrandLogo href="/" />
            <nav className="bw-desktop-nav" aria-label="Main navigation">
              <a href="#garage-results">Find a garage</a>
              <a href="#services">Services</a>
              <a href="#journey">How it works</a>
              <a href="#garages">For businesses</a>
            </nav>
            <div className="bw-nav-actions"><HomeAuthActions /></div>
            <details className="bw-mobile-nav">
              <summary aria-label="Open navigation menu"><span /><span /><span /></summary>
              <nav aria-label="Mobile navigation">
                <a href="#garage-results">Find garages & towing</a>
                <a href="#services">Services</a>
                <a href="#journey">How it works</a>
                <a href="#garages">For garages</a>
                <Link href="/login">Log in</Link>
                <Link href="/signup">Create an account</Link>
              </nav>
            </details>
          </div>
        </header>

        {/* BRAND-LED HERO / PRESERVES EXISTING BOOKING SEARCH HANDLERS */}
        <section id="find" className="bw-hero">
          <div className="bw-hero-grain" aria-hidden="true" />
          <div className="bw-shell bw-hero-layout">
            <div className="bw-hero-copy">
              <span className="bw-eyebrow bw-eyebrow-light"><span className="bw-pulse" /> Meet a better way to care for your car</span>
              <h1>Car care,<br /><em>minus the</em><br /><span>runaround.</span></h1>
              <p>Find nearby garages, compare listed prices and available times, then book your appointment — without the back-and-forth calls.</p>
              <div className="bw-hero-buttons">
                <a className="bw-button bw-button-orange" href="#garage-results">Explore garages <span aria-hidden="true">↗</span></a>
                <a className="bw-text-link" href="#journey">See how it works <span aria-hidden="true">↗</span></a>
              </div>
              <div className="bw-hero-benefits" aria-label="BandWhip advantages">
                <span><span className="bw-benefit-mark">✓</span> Clear service prices</span>
                <span><span className="bw-benefit-mark">✓</span> Real availability</span>
                <span><span className="bw-benefit-mark">✓</span> Instant booking</span>
              </div>
            </div>
            <div className="bw-preview" aria-label="Illustration of the BandWhip booking experience">
              <div className="bw-preview-top"><div className="bw-preview-dots"><i/><i/><i/></div><span>BandWhip booking</span><span className="bw-preview-status"><span/> Live calendar</span></div>
              <div className="bw-preview-body">
                <span className="bw-mini-eyebrow">YOUR NEXT APPOINTMENT</span>
                <h2>Everything in its place.</h2>
                <p>One simple flow, from searching to confirmed.</p>
                <div className="bw-preview-search"><span className="bw-preview-magnify">⌕</span> Oil change, tires, inspections... <span className="bw-preview-key">⌘ K</span></div>
                <div className="bw-preview-shop">
                  <div className="bw-preview-shop-icon"><svg viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="M9 27V17L16 10H29L36 17V27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="M15 27V21H30V27M11 32H34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></div>
                  <div><strong>Garage appointment</strong><span>Choose a service · pick a time</span></div>
                  <span className="bw-preview-check">✓</span>
                </div>
                <div className="bw-preview-calendar"><div><small>MON</small><strong>09</strong></div><div><small>TUE</small><strong>10</strong></div><div className="is-active"><small>WED</small><strong>11</strong></div><div><small>THU</small><strong>12</strong></div><div><small>FRI</small><strong>13</strong></div></div>
                <div className="bw-preview-times"><span>9:00 AM</span><span className="is-active">10:30 AM</span><span>1:00 PM</span></div>
                <div className="bw-preview-confirm"><span className="bw-preview-confirm-icon">✓</span><div><strong>Appointment confirmed</strong><small>No waiting for a callback</small></div><span aria-hidden="true">↗</span></div>
              </div>
              <div className="bw-preview-tag"><span>✦</span> Made for simpler car care</div>
              <p className="bw-preview-caption">Illustrative booking experience</p>
            </div>
          </div>
          <div className="bw-shell bw-search-wrap">
            <div className="bw-search-intro"><span>START HERE</span><strong>Where can we help?</strong><p>Set your preferences, then browse garages and towing providers.</p></div>
            <div className="bw-search-panel">
              <button type="button" className="bw-search-field bw-vehicle-field" onClick={() => setVehicleModalOpen(true)}>
                <span className="bw-search-icon" aria-hidden="true">01</span>
                <span className="bw-search-field-copy"><small>Your vehicle</small><strong>{vehicle ? [vehicle.year, vehicle.make, vehicle.model].join(" ") : "Add a vehicle"}</strong><span>{vehicle ? "Change your vehicle" : "Make your search more relevant"}</span></span>
                <span className="bw-field-arrow" aria-hidden="true">↗</span>
              </button>
              <a href="#garage-results" className="bw-search-field">
                <span className="bw-search-icon" aria-hidden="true">02</span>
                <span className="bw-search-field-copy"><small>Service</small><strong>What do you need?</strong><span>Garage or towing</span></span><span className="bw-field-arrow" aria-hidden="true">↗</span>
              </a>
              <div className="bw-search-date"><WhenPicker /></div>
              <div className="bw-search-field bw-search-location">
                <span className="bw-search-icon" aria-hidden="true">04</span>
                <span className="bw-search-field-copy"><small>Location</small><strong>Montréal, QC</strong><span>Launch region</span></span>
              </div>
              <a className="bw-search-submit" href="#garage-results" aria-label="Explore garages and towing providers">Explore <span aria-hidden="true">↗</span></a>
            </div>
            {vehicle && <button className="bw-clear-vehicle" type="button" onClick={handleClearVehicle}>Remove saved vehicle ×</button>}
          </div>
        </section>

        {/* JOURNEY */}

        <section id="journey" className="bw-journey mx-auto max-w-[1450px] px-8 py-24" data-bw-reveal>
          <div className="text-center">
            <p className="text-[17px] font-bold text-[#FF5B13]">
              How BandWhip works
            </p>

            <h2 className="mx-auto mt-3 max-w-[930px] text-[46px] font-bold tracking-[-0.04em] sm:text-[56px]">
              From car problem to booked
              garage in under 1 minute.
            </h2>

            <p className="mx-auto mt-5 max-w-[760px] text-[20px] leading-8 text-[#667085]">
              Three simple moments. One
              smooth experience.
            </p>
          </div>

          <div className="journey-scroll mt-16">
            <div className="journey-flow">
              <div className="timeline-card">
                <div className="timeline-art">
                  <BrokenCarScene />
                </div>

                <p className="mt-7 text-[15px] font-bold uppercase tracking-[0.14em] text-[#FF5B13]">
                  The problem
                </p>

                <h3 className="mt-3 text-[28px] font-bold">
                  Your car needs help
                </h3>

                <p className="mt-4 text-[18px] leading-8 text-[#667085]">
                  Something goes wrong and
                  you need the right garage
                  without wasting time
                  calling around.
                </p>
              </div>

              <TimelineConnector />

              <div className="timeline-card timeline-card-primary">
                <div className="timeline-art">
                  <BookingScene />
                </div>

                <p className="mt-7 text-[15px] font-bold uppercase tracking-[0.14em] text-[#FF5B13]">
                  Under 1 minute
                </p>

                <h3 className="mt-3 text-[28px] font-bold">
                  Book on BandWhip
                </h3>

                <p className="mt-4 text-[18px] leading-8 text-[#667085]">
                  Add your vehicle, choose
                  your service and reserve
                  the garage that works
                  best for you.
                </p>
              </div>

              <TimelineConnector />

              <div className="timeline-card">
                <div className="timeline-art">
                  <KeysScene />
                </div>

                <p className="mt-7 text-[15px] font-bold uppercase tracking-[0.14em] text-[#31A66A]">
                  Done
                </p>

                <h3 className="mt-3 text-[28px] font-bold">
                  Back on the road
                </h3>

                <p className="mt-4 text-[18px] leading-8 text-[#667085]">
                  Your garage completes the
                  service, hands your keys
                  back and you’re ready to
                  drive again.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}

        <section
          id="services"
          className="bw-services bg-[#F5F7FA]"
        >
          <div className="mx-auto max-w-[1350px] px-8 py-24">
            <div className="mb-12 text-center">
              <p className="text-[17px] font-bold text-[#FF5B13]">
                Popular services
              </p>

              <h2 className="mx-auto mt-3 max-w-[950px] text-[46px] font-bold tracking-[-0.04em] sm:text-[56px]">
                What does your vehicle
                need?
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map(
                (service) => (
                  <a href={`/?service=${encodeURIComponent(service.title)}#garage-results`} key={service.title} className="group rounded-[28px] border border-[#EAECF0] bg-white p-8 text-left transition duration-300 hover:-translate-y-2 hover:border-[#FF5B13]/40 hover:shadow-[0_22px_60px_rgba(16,24,40,0.12)]"
                  >
                    <div className="flex h-[82px] w-[82px] items-center justify-center rounded-[24px] bg-[#EDF3FA] text-[42px]">
                      {
                        service.icon
                      }
                    </div>

                    <h3 className="mt-10 text-[25px] font-bold">
                      {
                        service.title
                      }
                    </h3>

                    <p className="mt-3 min-h-[64px] text-[18px] leading-7 text-[#667085]">
                      {
                        service.description
                      }
                    </p>

                    <p className="mt-8 text-[17px] font-bold text-[#FF5B13]">
                      Find a garage →
                    </p>
                  </a>
                )
              )}
            </div>

            <div className="mt-10 text-center">
              <a href="#garage-results" className="text-[18px] font-semibold text-[#475467] transition hover:text-[#FF5B13]">
                Browse garages & towing →
              </a>
            </div>
          </div>
        </section>

        {/* GARAGES */}

        <section id="garage-results" data-bw-reveal className="bw-listings mx-auto max-w-[1350px] scroll-mt-28 px-8 py-24">
          <div className="mb-12 text-center">
            <p className="text-[17px] font-bold text-[#FF5B13]">
              Available near you
            </p>

            <h2 className="mx-auto mt-3 max-w-[950px] text-[46px] font-bold tracking-[-0.04em] sm:text-[56px]">
              Garages and towing ready to help.
            </h2>
          </div>

          <LiveGarages />
        </section>


        {/* THE BUSINESS PROMISE */}
        <section id="garages" className="bw-business" data-bw-reveal>
          <div className="bw-shell">
            <div className="bw-business-card">
              <div className="bw-business-copy">
                <span className="bw-eyebrow bw-eyebrow-light">FOR GARAGES & TOWING TEAMS</span>
                <h2>Spend less time<br /><em>on the phone.</em><br />More time doing.</h2>
                <p>Stay in control of your hours, your services and your appointments in one organized workspace. When an available slot is booked, everyone knows what's next.</p>
                <Link className="bw-button bw-button-orange" href="/signup">List your business <span aria-hidden="true">↗</span></Link>
              </div>
              <div className="bw-calendar-demo">
                <div className="bw-calendar-header"><div><small>YOUR WORKSPACE</small><strong>Capacity, made clearer.</strong></div><span className="bw-calendar-pill">Interactive preview</span></div>
                <div className="bw-demo-control"><label htmlFor="demo-bays">Available service bays</label><div><button type="button" onClick={() => setDemoBays(Math.max(1, demoBays - 1))} aria-label="Remove one service bay">−</button><span>{demoBays}</span><button type="button" onClick={() => setDemoBays(Math.min(4, demoBays + 1))} aria-label="Add one service bay">+</button></div></div>
                <div className="bw-demo-grid">{[1,2,3,4].map((number) => <div key={number} className={number <= demoBays ? "bw-demo-bay is-active" : "bw-demo-bay"}><span>Bay {number}</span><strong>{number <= demoBays ? "Available" : "Closed"}</strong><small>{number <= demoBays ? "Ready for appointments" : "Not bookable"}</small></div>)}</div>
                <div className="bw-calendar-note"><span>✓</span> Closed bays won't appear as bookable availability.</div>
                <small className="bw-demo-disclaimer">Demo only — no changes are made to a real garage calendar.</small>
              </div>
            </div>
          </div>
        </section>

        <section className="bw-closing" data-bw-reveal>
          <div className="bw-shell bw-closing-inner"><span className="bw-eyebrow">THE SIMPLE WAY FORWARD</span><h2>Good service starts<br />with a <em>better booking.</em></h2><a className="bw-button bw-button-orange" href="#garage-results">Find your next garage <span aria-hidden="true">↗</span></a></div>
        </section>
        <footer className="bw-footer">
          <div className="bw-shell">
            <div className="bw-footer-top"><div><BrandLogo inverse /><p>Car care, made refreshingly simple.<br />Built for drivers and businesses in Québec.</p></div><nav aria-label="Footer navigation"><a href="#garage-results">Explore providers</a><a href="#services">Services</a><a href="#journey">How it works</a><Link href="/signup">For businesses</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></div>
            <div className="bw-footer-word" aria-hidden="true">BandWhip</div>
            <div className="bw-footer-bottom"><span>© {new Date().getFullYear()} BandWhip.</span><span>Montréal, Québec · Canada</span><a href="#find">Back to top ↑</a></div>
          </div>
        </footer>
      </main>
    </>
  );
}