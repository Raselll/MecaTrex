"use client";

import Image from "next/image";
import Script from "next/script";
import Link from "next/link";
import LiveGarages from "@/components/home/live-garages";
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
  Blue: "#4771A6",
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
          MECATREX could not load the
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
        <div className="h-12 w-12 animate-spin rounded-full border-[4px] border-[#DCE4EE] border-t-[#4771A6]" />

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
        {/* HEADER */}

        <div className="flex items-start justify-between border-b border-[#EAECF0] px-8 py-6 sm:px-9">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">
              Your vehicle
            </p>

            <h2 className="mt-2 text-[31px] font-bold tracking-[-0.04em] text-[#101828]">
              {vehicle
                ? "Edit your vehicle"
                : "Add your vehicle"}
            </h2>

            <p className="mt-2 max-w-[560px] text-[16px] leading-6 text-[#667085]">
              Add a few details so
              MECATREX can personalize
              your garage search.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F2F4F7] text-[22px] text-[#475467] transition hover:bg-[#EAECF0] hover:text-[#101828]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
        >
          <div className="grid gap-8 px-8 py-8 sm:px-9 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
            {/* FORM */}

            <div>
              <div className="grid gap-5">
                {/* YEAR */}

                <div>
                  <label
                    htmlFor="vehicle-year"
                    className="mb-2 block text-[14px] font-bold text-[#344054]"
                  >
                    Year
                  </label>

                  <select
                    id="vehicle-year"
                    value={year}
                    onChange={(
                      event
                    ) =>
                      setYear(
                        event
                          .target
                          .value
                      )
                    }
                    required
                    className="h-[58px] w-full cursor-pointer rounded-[16px] border border-[#D0D5DD] bg-white px-5 text-[17px] font-semibold text-[#101828] outline-none transition focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
                  >
                    <option value="">
                      Select year
                    </option>

                    {years.map(
                      (item) => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* MAKE */}

                <div>
                  <label
                    htmlFor="vehicle-make"
                    className="mb-2 block text-[14px] font-bold text-[#344054]"
                  >
                    Make
                  </label>

                  <select
                    id="vehicle-make"
                    value={make}
                    onChange={(
                      event
                    ) => {
                      const nextMake =
                        event
                          .target
                          .value;

                      setMake(
                        nextMake
                      );

                      /*
                       * Reset model when
                       * manufacturer changes.
                       */
                      setModel("");
                    }}
                    required
                    className="h-[58px] w-full cursor-pointer rounded-[16px] border border-[#D0D5DD] bg-white px-5 text-[17px] font-semibold text-[#101828] outline-none transition focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
                  >
                    <option value="">
                      Select make
                    </option>

                    {makes.map(
                      (item) => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* MODEL */}

                <div>
                  <label
                    htmlFor="vehicle-model"
                    className="mb-2 block text-[14px] font-bold text-[#344054]"
                  >
                    Model
                  </label>

                  <select
                    id="vehicle-model"
                    value={model}
                    onChange={(
                      event
                    ) =>
                      setModel(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      !make
                    }
                    required
                    className="h-[58px] w-full cursor-pointer rounded-[16px] border border-[#D0D5DD] bg-white px-5 text-[17px] font-semibold text-[#101828] outline-none transition focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10 disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#98A2B3]"
                  >
                    <option value="">
                      {make
                        ? "Select model"
                        : "Select a make first"}
                    </option>

                    {modelSuggestions.map(
                      (item) => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* COLOR */}

                <div>
                  <label
                    htmlFor="vehicle-color"
                    className="mb-2 block text-[14px] font-bold text-[#344054]"
                  >
                    Color{" "}
                    <span className="font-medium text-[#98A2B3]">
                      (optional)
                    </span>
                  </label>

                  <select
                    id="vehicle-color"
                    value={color}
                    onChange={(
                      event
                    ) =>
                      setColor(
                        event
                          .target
                          .value
                      )
                    }
                    className="h-[58px] w-full cursor-pointer rounded-[16px] border border-[#D0D5DD] bg-white px-5 text-[17px] font-semibold text-[#101828] outline-none transition focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
                  >
                    <option value="">
                      Select color
                    </option>

                    {vehicleColors.map(
                      (item) => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>

                  <p className="mt-2 text-[12px] leading-5 text-[#98A2B3]">
                    Used to help identify
                    your vehicle. The 3D
                    preview color may differ.
                  </p>
                </div>
              </div>

              {/* SELECTED VEHICLE */}

              {year &&
                make &&
                model && (
                  <div className="mt-6 flex items-center gap-4 rounded-[18px] bg-[#EDF3FA] px-5 py-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white text-[23px] shadow-sm">
                      🚙
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#4771A6]">
                        Selected
                      </p>

                      <p className="mt-0.5 truncate text-[17px] font-bold text-[#101828]">
                        {year}{" "}
                        {make}{" "}
                        {model}
                      </p>

                      {color && (
                        <div className="mt-1.5 flex items-center gap-2 text-[13px] font-medium text-[#667085]">
                          <span
                            className="h-3 w-3 rounded-full border border-black/10"
                            style={{
                              background:
                                colorSwatches[
                                  color
                                ] ||
                                "#D0D5DD",
                            }}
                          />

                          {
                            color
                          }
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* 3D PREVIEW */}

            <Vehicle3DViewer
              year={year}
              make={make}
              model={model}
              color={color}
              loaderReady={
                loaderReady
              }
              loaderError={
                loaderError
              }
            />
          </div>

          {/* FOOTER */}

          <div className="flex flex-col-reverse gap-4 border-t border-[#EAECF0] px-8 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-9">
            <div>
              {vehicle && (
                <button
                  type="button"
                  onClick={
                    onClear
                  }
                  className="rounded-xl px-4 py-3 text-[14px] font-semibold text-[#B42318] transition hover:bg-[#FEF3F2]"
                >
                  Clear saved vehicle
                </button>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={
                  onClose
                }
                className="rounded-[14px] border border-[#D0D5DD] bg-white px-6 py-3.5 text-[15px] font-bold text-[#344054] transition hover:bg-[#F9FAFB]"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-[14px] bg-[#4771A6] px-7 py-3.5 text-[15px] font-bold text-white transition hover:bg-[#3C6190]"
              >
                {vehicle
                  ? "Save changes"
                  : "Add vehicle"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========================================================= */
/* SHARED CARTOON CAR */
/* ========================================================= */

function MecatrexCar({
  transform,
}: {
  transform?: string;
}) {
  return (
    <g transform={transform}>
      <path
        d="M66 148L82 113C86 104 94 98 104 98H190C200 98 209 103 214 111L234 148"
        fill="#4771A6"
      />

      <rect
        x="56"
        y="140"
        width="188"
        height="42"
        rx="16"
        fill="#315C91"
      />

      <path
        d="M103 108H145V138H89L101 111C102 110 102 109 103 108Z"
        fill="#CFE0F4"
      />

      <path
        d="M153 108H190C195 108 200 111 203 116L218 138H153V108Z"
        fill="#CFE0F4"
      />

      <circle
        cx="96"
        cy="181"
        r="18"
        fill="#172131"
      />

      <circle
        cx="96"
        cy="181"
        r="8"
        fill="#DCE4EE"
      />

      <circle
        cx="204"
        cy="181"
        r="18"
        fill="#172131"
      />

      <circle
        cx="204"
        cy="181"
        r="8"
        fill="#DCE4EE"
      />

      <rect
        x="63"
        y="150"
        width="17"
        height="8"
        rx="4"
        fill="#EFF5FB"
      />

      <rect
        x="220"
        y="150"
        width="17"
        height="8"
        rx="4"
        fill="#F4C95D"
      />
    </g>
  );
}

/* ========================================================= */
/* SCENE 1 */
/* ========================================================= */

function BrokenCarScene() {
  return (
    <svg
      viewBox="0 0 360 240"
      className="h-full w-full"
      aria-label="Driver reacting to a broken car"
    >
      <rect
        width="360"
        height="240"
        rx="28"
        fill="#F6F8FB"
      />

      <rect
        x="32"
        y="193"
        width="296"
        height="3"
        rx="2"
        fill="#D8E0EA"
      />

      <path
        d="M66 148L82 113C86 104 94 98 104 98H190C200 98 209 103 214 111L234 148"
        fill="#4771A6"
      />

      <rect
        x="56"
        y="140"
        width="188"
        height="42"
        rx="16"
        fill="#315C91"
      />

      <path
        d="M103 108H145V138H89L101 111C102 110 102 109 103 108Z"
        fill="#CFE0F4"
      />

      <path
        d="M153 108H190C195 108 200 111 203 116L218 138H153V108Z"
        fill="#CFE0F4"
      />

      <path
        d="M224 140L251 111L257 117L230 146Z"
        fill="#4771A6"
      />

      <circle
        cx="96"
        cy="181"
        r="18"
        fill="#172131"
      />

      <circle
        cx="96"
        cy="181"
        r="8"
        fill="#DCE4EE"
      />

      <circle
        cx="204"
        cy="181"
        r="18"
        fill="#172131"
      />

      <circle
        cx="204"
        cy="181"
        r="8"
        fill="#DCE4EE"
      />

      <rect
        x="63"
        y="150"
        width="17"
        height="8"
        rx="4"
        fill="#EFF5FB"
      />

      <rect
        x="220"
        y="150"
        width="17"
        height="8"
        rx="4"
        fill="#F4C95D"
      />

      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 4;4 -3;9 -13;0 4"
          dur="3.2s"
          repeatCount="indefinite"
        />

        <animate
          attributeName="opacity"
          values="0.3;0.7;0.2;0.3"
          dur="3.2s"
          repeatCount="indefinite"
        />

        <circle
          cx="237"
          cy="126"
          r="8"
          fill="#111111"
        />

        <circle
          cx="247"
          cy="113"
          r="11"
          fill="#111111"
        />

        <circle
          cx="258"
          cy="99"
          r="8"
          fill="#111111"
        />
      </g>

      <g>
        <circle
          cx="296"
          cy="93"
          r="17"
          fill="#E0A277"
        />

        <path
          d="M280 84C283 67 306 67 312 81C307 78 301 77 295 77C289 77 284 80 280 84Z"
          fill="#172131"
        />

        <circle
          cx="290"
          cy="93"
          r="2"
          fill="#172131"
        />

        <circle
          cx="302"
          cy="93"
          r="2"
          fill="#172131"
        />

        <path
          d="M290 104C294 99 299 99 303 104"
          fill="none"
          stroke="#8B5E48"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <rect
          x="278"
          y="110"
          width="38"
          height="51"
          rx="14"
          fill="#83A7D3"
        />

        <path
          d="M281 120Q269 139 271 158"
          fill="none"
          stroke="#E0A277"
          strokeWidth="10"
          strokeLinecap="round"
        >
          <animate
            attributeName="d"
            values="
              M281 120Q269 139 271 158;
              M281 120Q269 139 271 158;
              M281 120Q274 102 287 85;
              M281 120Q274 102 287 85;
              M281 120Q269 139 271 158;
              M281 120Q269 139 271 158
            "
            keyTimes="0;0.15;0.34;0.62;0.81;1"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </path>

        <circle
          cx="271"
          cy="158"
          r="6"
          fill="#E0A277"
        >
          <animate
            attributeName="cx"
            values="271;271;287;287;271;271"
            keyTimes="0;0.15;0.34;0.62;0.81;1"
            dur="3.2s"
            repeatCount="indefinite"
          />

          <animate
            attributeName="cy"
            values="158;158;85;85;158;158"
            keyTimes="0;0.15;0.34;0.62;0.81;1"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </circle>

        <path
          d="M313 120Q323 139 321 158"
          fill="none"
          stroke="#E0A277"
          strokeWidth="10"
          strokeLinecap="round"
        >
          <animate
            attributeName="d"
            values="
              M313 120Q323 139 321 158;
              M313 120Q323 139 321 158;
              M313 120Q318 102 305 85;
              M313 120Q318 102 305 85;
              M313 120Q323 139 321 158;
              M313 120Q323 139 321 158
            "
            keyTimes="0;0.15;0.34;0.62;0.81;1"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </path>

        <circle
          cx="321"
          cy="158"
          r="6"
          fill="#E0A277"
        >
          <animate
            attributeName="cx"
            values="321;321;305;305;321;321"
            keyTimes="0;0.15;0.34;0.62;0.81;1"
            dur="3.2s"
            repeatCount="indefinite"
          />

          <animate
            attributeName="cy"
            values="158;158;85;85;158;158"
            keyTimes="0;0.15;0.34;0.62;0.81;1"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </circle>

        <rect
          x="284"
          y="157"
          width="12"
          height="38"
          rx="6"
          transform="rotate(5 284 157)"
          fill="#26374D"
        />

        <rect
          x="301"
          y="157"
          width="12"
          height="38"
          rx="6"
          transform="rotate(-5 301 157)"
          fill="#26374D"
        />
      </g>

      <g
        stroke="#E34D59"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0"
      >
        <animate
          attributeName="opacity"
          values="0;0;1;1;0;0"
          keyTimes="0;0.25;0.36;0.62;0.77;1"
          dur="3.2s"
          repeatCount="indefinite"
        />

        <line
          x1="316"
          y1="65"
          x2="326"
          y2="53"
        />

        <line
          x1="325"
          y1="75"
          x2="339"
          y2="70"
        />

        <line
          x1="306"
          y1="61"
          x2="308"
          y2="46"
        />
      </g>
    </svg>
  );
}

/* ========================================================= */
/* SCENE 2 */
/* ========================================================= */

function BookingScene() {
  return (
    <svg
      viewBox="0 0 360 240"
      className="h-full w-full"
      aria-label="Customer booking through MECATREX"
    >
      <rect
        width="360"
        height="240"
        rx="28"
        fill="#F6F8FB"
      />

      <circle
        cx="180"
        cy="120"
        r="104"
        fill="#EAF2FB"
      />

      <path
        d="M70 240V206C70 164 99 138 138 131H222C261 138 290 164 290 206V240Z"
        fill="#4771A6"
      />

      <path
        d="M70 208C97 185 121 176 145 173H215C241 177 265 187 290 208V240H70Z"
        fill="#3A669C"
      />

      <circle
        cx="180"
        cy="88"
        r="52"
        fill="#E0A277"
      />

      <path
        d="M128 84C129 44 155 25 181 25C211 25 232 45 232 84C220 62 203 54 181 54C159 54 141 64 128 84Z"
        fill="#172131"
      />

      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 -3;0 0"
          dur="3s"
          repeatCount="indefinite"
        />

        <rect
          x="104"
          y="66"
          width="152"
          height="168"
          rx="28"
          fill="#172131"
        />

        <rect
          x="115"
          y="77"
          width="130"
          height="146"
          rx="20"
          fill="#FFFFFF"
        />

        <rect
          x="165"
          y="84"
          width="30"
          height="4"
          rx="2"
          fill="#CBD5E1"
        />

        <g transform="translate(128 101)">
          <rect
            width="34"
            height="34"
            rx="9"
            fill="#172131"
          />

          <path
            d="M8 24V11L17 18L26 11V24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M17 18L25 12"
            stroke="#4771A6"
            strokeWidth="3.8"
            strokeLinecap="round"
          />
        </g>

        <text
          x="170"
          y="123"
          fontSize="10.8"
          fontWeight="900"
          fill="#172131"
        >
          MECATREX
        </text>

        <rect
          x="130"
          y="145"
          width="98"
          height="8"
          rx="4"
          fill="#DCE4EE"
        />

        <rect
          x="130"
          y="159"
          width="80"
          height="7"
          rx="3.5"
          fill="#DCE4EE"
        />

        <rect
          x="130"
          y="178"
          width="98"
          height="34"
          rx="12"
          fill="#4771A6"
        />

        <text
          x="179"
          y="199"
          textAnchor="middle"
          fontSize="10.5"
          fontWeight="800"
          fill="#FFFFFF"
        >
          Book garage
        </text>

        <rect
          x="130"
          y="178"
          width="98"
          height="34"
          rx="12"
          fill="none"
          stroke="#83A7D3"
          strokeWidth="3"
          opacity="0"
        >
          <animate
            attributeName="opacity"
            values="0;0.8;0"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>
      </g>

      <path
        d="M88 206Q113 182 128 178"
        fill="none"
        stroke="#E0A277"
        strokeWidth="16"
        strokeLinecap="round"
      />

      <circle
        cx="128"
        cy="178"
        r="10"
        fill="#E0A277"
      />

      <path
        d="M272 206Q247 182 232 178"
        fill="none"
        stroke="#E0A277"
        strokeWidth="16"
        strokeLinecap="round"
      />

      <circle
        cx="232"
        cy="178"
        r="10"
        fill="#E0A277"
      />

      <circle
        cx="218"
        cy="195"
        r="6"
        fill="#E0A277"
      >
        <animate
          attributeName="cy"
          values="195;189;195"
          dur="1.7s"
          repeatCount="indefinite"
        />
      </circle>

      <g
        stroke="#83A7D3"
        strokeWidth="4"
        strokeLinecap="round"
      >
        <animate
          attributeName="opacity"
          values="0.25;1;0.25"
          dur="1.8s"
          repeatCount="indefinite"
        />

        <line
          x1="269"
          y1="111"
          x2="285"
          y2="101"
        />

        <line
          x1="273"
          y1="127"
          x2="293"
          y2="127"
        />

        <line
          x1="269"
          y1="143"
          x2="285"
          y2="153"
        />
      </g>
    </svg>
  );
}

/* ========================================================= */
/* SCENE 3 */
/* ========================================================= */

function KeysScene() {
  return (
    <svg
      viewBox="0 0 360 240"
      className="h-full w-full"
      aria-label="Happy customer receiving keys and thinking about driving away"
    >
      <rect
        width="360"
        height="240"
        rx="28"
        fill="#F6F8FB"
      />

      <ellipse
        cx="118"
        cy="69"
        rx="90"
        ry="53"
        fill="#FFFFFF"
        stroke="#DCE4EE"
        strokeWidth="2"
      />

      <circle
        cx="82"
        cy="126"
        r="11"
        fill="#FFFFFF"
        stroke="#DCE4EE"
        strokeWidth="2"
      />

      <circle
        cx="68"
        cy="145"
        r="6"
        fill="#FFFFFF"
        stroke="#DCE4EE"
        strokeWidth="2"
      />

      <circle
        cx="177"
        cy="39"
        r="11"
        fill="#F6C954"
      />

      <path
        d="M32 80C50 66 70 67 87 79C102 66 125 64 143 78C157 68 176 69 195 82V94H32Z"
        fill="#CFE4C5"
      />

      <path
        d="M29 91H203"
        stroke="#B9C9DA"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;-20 0;0 0"
          dur="2.4s"
          repeatCount="indefinite"
        />

        <line
          x1="45"
          y1="91"
          x2="61"
          y2="91"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <line
          x1="81"
          y1="91"
          x2="97"
          y2="91"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <line
          x1="117"
          y1="91"
          x2="133"
          y2="91"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <line
          x1="153"
          y1="91"
          x2="169"
          y2="91"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>

      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="-3 0;4 0;-3 0"
          dur="2.8s"
          repeatCount="indefinite"
        />

        <g transform="matrix(0.46 0 0 0.46 47 9)">
          <MecatrexCar />

          <circle
            cx="181"
            cy="119"
            r="10"
            fill="#E0A277"
          />

          <path
            d="M172 116C173 106 188 104 192 113C187 110 182 110 178 111C175 112 173 114 172 116Z"
            fill="#172131"
          />

          <circle
            cx="178"
            cy="119"
            r="1"
            fill="#172131"
          />

          <circle
            cx="184"
            cy="119"
            r="1"
            fill="#172131"
          />

          <path
            d="M178 124Q181 127 185 124"
            fill="none"
            stroke="#8B5E48"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>

      <g>
        <circle
          cx="95"
          cy="180"
          r="20"
          fill="#E0A277"
        />

        <path
          d="M77 173C80 155 105 153 113 169C105 164 98 163 91 165C85 166 81 169 77 173Z"
          fill="#172131"
        />

        <path
          d="M86 179Q89 175 92 179"
          fill="none"
          stroke="#172131"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <path
          d="M99 179Q102 175 105 179"
          fill="none"
          stroke="#172131"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <path
          d="M86 188Q95 196 104 188"
          fill="none"
          stroke="#8B5E48"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <rect
          x="67"
          y="202"
          width="56"
          height="38"
          rx="17"
          fill="#83A7D3"
        />

        <path
          d="M116 209Q140 199 160 195"
          fill="none"
          stroke="#E0A277"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </g>

      <g>
        <circle
          cx="276"
          cy="180"
          r="20"
          fill="#D99A6C"
        />

        <path
          d="M258 173C261 155 286 153 294 169C286 164 279 163 272 165C266 166 262 169 258 173Z"
          fill="#172131"
        />

        <circle
          cx="269"
          cy="179"
          r="2"
          fill="#172131"
        />

        <circle
          cx="282"
          cy="179"
          r="2"
          fill="#172131"
        />

        <path
          d="M268 188Q276 193 284 188"
          fill="none"
          stroke="#895D44"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <rect
          x="248"
          y="202"
          width="56"
          height="38"
          rx="17"
          fill="#26374D"
        />

        <rect
          x="273"
          y="202"
          width="5"
          height="38"
          rx="2"
          fill="#4771A6"
        />

        <circle
          cx="288"
          cy="214"
          r="4"
          fill="#4771A6"
        />

        <path
          d="M251 209Q228 199 207 195"
          fill="none"
          stroke="#D99A6C"
          strokeWidth="12"
          strokeLinecap="round"
        />
      </g>

      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="8 0;-8 0;8 0"
          dur="2.7s"
          repeatCount="indefinite"
        />

        <circle
          cx="182"
          cy="195"
          r="11"
          fill="none"
          stroke="#D7A927"
          strokeWidth="5"
        />

        <line
          x1="193"
          y1="195"
          x2="215"
          y2="195"
          stroke="#D7A927"
          strokeWidth="5"
          strokeLinecap="round"
        />

        <line
          x1="206"
          y1="195"
          x2="206"
          y2="203"
          stroke="#D7A927"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function TimelineConnector() {
  return (
    <div
      className="timeline-connector"
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </div>
  );
}

/* ========================================================= */
/* PAGE */
/* ========================================================= */

export default function Home() {
  const [
    vehicleModalOpen,
    setVehicleModalOpen,
  ] = useState(false);

  const [
    vehicle,
    setVehicle,
  ] =
    useState<Vehicle | null>(null);

  const [
    carImagesReady,
    setCarImagesReady,
  ] = useState(false);

  const [
    carImagesLoadError,
    setCarImagesLoadError,
  ] = useState(false);

  useEffect(() => {
    try {
      const storedVehicle =
        window.localStorage.getItem(
          VEHICLE_STORAGE_KEY
        );

      if (!storedVehicle) {
        return;
      }

      const parsedVehicle =
        JSON.parse(
          storedVehicle
        ) as Vehicle;

      if (
        parsedVehicle.year &&
        parsedVehicle.make &&
        parsedVehicle.model
      ) {
        setVehicle(
          parsedVehicle
        );
      }
    } catch {
      window.localStorage.removeItem(
        VEHICLE_STORAGE_KEY
      );
    }
  }, []);

  function handleSaveVehicle(
    nextVehicle: Vehicle
  ) {
    setVehicle(
      nextVehicle
    );

    window.localStorage.setItem(
      VEHICLE_STORAGE_KEY,
      JSON.stringify(
        nextVehicle
      )
    );

    setVehicleModalOpen(
      false
    );
  }

  function handleClearVehicle() {
    setVehicle(null);

    window.localStorage.removeItem(
      VEHICLE_STORAGE_KEY
    );

    setVehicleModalOpen(
      false
    );
  }

  return (
    <>
      {/* CARIMAGESAPI */}

      {CAR_IMAGES_API_KEY && (
        <Script
          id="carimages-api-loader"
          src="https://carimagesapi.com/assets/js/carimages.js"
          data-api-key={
            CAR_IMAGES_API_KEY
          }
          strategy="afterInteractive"
          onReady={() => {
            setCarImagesReady(
              true
            );

            setCarImagesLoadError(
              false
            );
          }}
          onError={() => {
            setCarImagesReady(
              false
            );

            setCarImagesLoadError(
              true
            );
          }}
        />
      )}

      <VehicleModal
        open={
          vehicleModalOpen
        }
        vehicle={vehicle}
        onClose={() =>
          setVehicleModalOpen(
            false
          )
        }
        onSave={
          handleSaveVehicle
        }
        onClear={
          handleClearVehicle
        }
        loaderReady={
          carImagesReady
        }
        loaderError={
          carImagesLoadError
        }
      />

      <main className="min-h-screen bg-white text-[#101828]">
        {/* HEADER */}

        <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex h-[102px] max-w-[1400px] items-center justify-between px-8">
            <a
              href="#"
              className="flex shrink-0 items-center"
            >
              <Image
                src="/mecatrex-logo-web.png"
                alt="MECATREX"
                width={320}
                height={90}
                priority
                className="h-[64px] w-auto object-contain"
              />
            </a>

            <nav className="hidden items-center gap-10 lg:flex">
              <a
                href="#garage-results"
                className="text-[18px] font-semibold text-[#344054] transition hover:text-[#4771A6]"
              >
                Find a garage
              </a>

              <a
                href="#services"
                className="text-[18px] font-semibold text-[#344054] transition hover:text-[#4771A6]"
              >
                Services
              </a>

              <a
                href="#garages"
                className="text-[18px] font-semibold text-[#344054] transition hover:text-[#4771A6]"
              >
                For garages
              </a>

              <span className="cursor-default text-[18px] font-semibold text-[#98A2B3]" title="Deals are coming soon">
                Deals · soon
              </span>
            </nav>

            <div className="flex items-center gap-4">
              <Link href="/login" className="hidden rounded-xl px-6 py-3.5 text-[17px] font-semibold text-[#344054] transition hover:bg-[#F2F4F7] sm:block">
                Log in
              </Link>

              <Link href="/signup" className="rounded-xl bg-[#101828] px-7 py-3.5 text-[17px] font-semibold text-white transition hover:bg-[#4771A6]">
                Sign up
              </Link>
            </div>
          </div>
        </header>

        {/* HERO */}

        <section
          id="find"
          className="px-5 pt-7 lg:px-8"
        >
          <div className="relative mx-auto max-w-[1450px] overflow-hidden rounded-[36px] bg-[#0D1B2A]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(71,113,166,0.52),transparent_48%)]" />

            <div className="absolute left-1/2 top-[-340px] h-[800px] w-[800px] -translate-x-1/2 rounded-full border border-white/[0.07]" />

            <div className="absolute left-1/2 top-[-230px] h-[600px] w-[600px] -translate-x-1/2 rounded-full border border-white/[0.07]" />

            <div className="relative z-10 flex min-h-[720px] flex-col items-center justify-center px-8 py-20 text-center">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-[17px] font-semibold text-white backdrop-blur-md">
                <span className="h-3 w-3 rounded-full bg-[#83A7D3]" />

                Vehicle service made simple
              </div>

              <h1 className="mx-auto max-w-[1100px] text-[58px] font-bold leading-[1.03] tracking-[-0.05em] text-white sm:text-[72px] lg:text-[84px]">
                Your car needs service.

                <span className="mt-3 block text-[#83A7D3]">
                  Book the right garage
                  in 1 minute.
                </span>
              </h1>

              <p className="mx-auto mt-8 max-w-[820px] text-[21px] leading-9 text-white/70 sm:text-[23px]">
                Tell us what your
                vehicle needs, compare
                nearby garages and book
                your appointment —
                without making a single
                phone call.
              </p>

              {/* SEARCH */}

              <div className="mt-14 w-full max-w-[1180px] rounded-[28px] bg-white p-3 shadow-[0_30px_100px_rgba(0,0,0,0.3)]">
                <div className="grid gap-2 lg:grid-cols-[1fr_1.15fr_0.9fr_0.85fr_0.75fr]">
                  {/* VEHICLE */}

                  <div className="group relative min-h-[110px] overflow-hidden rounded-[20px] transition hover:bg-[#F8FAFC]">
                    <button
                      type="button"
                      onClick={() =>
                        setVehicleModalOpen(
                          true
                        )
                      }
                      className="flex min-h-[110px] w-full flex-col items-center justify-center px-6 py-4 text-center"
                    >
                      <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
                        Vehicle
                      </p>

                      <p className="mt-2.5 max-w-[260px] truncate text-[19px] font-semibold text-[#101828] transition group-hover:-translate-y-1">
                        {vehicle
                          ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
                          : "Add your vehicle"}
                      </p>

                      {vehicle ? (
                        <div className="relative mt-1.5 h-[21px] w-full">
                          {/* NORMAL */}

                          <div className="absolute inset-0 flex items-center justify-center gap-2 text-[13px] font-medium text-[#98A2B3] transition duration-200 group-hover:pointer-events-none group-hover:opacity-0">
                            {vehicle.color ? (
                              <>
                                <span
                                  className="h-2.5 w-2.5 rounded-full border border-black/10"
                                  style={{
                                    background:
                                      colorSwatches[
                                        vehicle
                                          .color
                                      ] ||
                                      "#D0D5DD",
                                  }}
                                />

                                {
                                  vehicle.color
                                }
                              </>
                            ) : (
                              "Saved vehicle"
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="mt-1 text-[14px] font-semibold text-[#4771A6]">
                          Choose vehicle
                        </span>
                      )}
                    </button>

                    {/* HOVER ACTIONS */}

                    {vehicle && (
                      <div className="pointer-events-none absolute bottom-[13px] left-0 right-0 z-10 flex items-center justify-center gap-3 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() =>
                            setVehicleModalOpen(
                              true
                            )
                          }
                          className="text-[13px] font-bold text-[#4771A6] transition hover:text-[#315C91]"
                        >
                          Change vehicle
                        </button>

                        <span className="text-[#D0D5DD]">
                          •
                        </span>

                        <button
                          type="button"
                          onClick={
                            handleClearVehicle
                          }
                          className="text-[13px] font-bold text-[#667085] transition hover:text-[#B42318]"
                        >
                          Clear saved vehicle
                        </button>
                      </div>
                    )}
                  </div>

                  {/* REPAIR */}

                  <a href="#garage-results" className="flex min-h-[110px] flex-col items-center justify-center rounded-[20px] px-6 py-5 text-center transition hover:bg-[#EDF3FA] focus-visible:outline-[#4771A6]">
                    <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
                      Repair or service
                    </p>

                    <p className="mt-2.5 text-[19px] font-semibold text-[#101828]">
                      What does your
                      vehicle need?
                    </p>

                    <span className="mt-1 text-[20px] text-[#98A2B3]">
                      ↓
                    </span>
                  </a>

                  {/* WHEN */}

                  <WhenPicker />

                  {/* LOCATION */}

                  <div className="flex min-h-[110px] cursor-default flex-col items-center justify-center rounded-[20px] px-6 py-5 text-center">
                    <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
                      Location
                    </p>

                    <p className="mt-2.5 text-[19px] font-semibold text-[#101828]">
                      Montreal, QC
                    </p>

                    <span className="mt-1 text-[12px] font-medium text-[#98A2B3]">Launch city</span>
                  </div>

                  {/* SEARCH */}

                  <div className="flex p-1">
                    <a href="#garage-results" className="flex w-full items-center justify-center rounded-[20px] bg-[#4771A6] px-8 py-5 text-center text-[19px] font-bold text-white transition hover:bg-[#3C6190]">
                      Find garages
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-9 flex flex-wrap justify-center gap-x-10 gap-y-5 text-[17px] font-medium text-white/70">
                <span>
                  ✓ Compare prices
                </span>

                <span>
                  ✓ Real availability
                </span>

                <span>
                  ✓ Instant booking
                </span>

                <span>
                  ✓ Towing when needed
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* JOURNEY */}

        <section className="mx-auto max-w-[1450px] px-8 py-24">
          <div className="text-center">
            <p className="text-[17px] font-bold text-[#4771A6]">
              How MECATREX works
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

                <p className="mt-7 text-[15px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">
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

                <p className="mt-7 text-[15px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">
                  Under 1 minute
                </p>

                <h3 className="mt-3 text-[28px] font-bold">
                  Book on MECATREX
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
          className="bg-[#F5F7FA]"
        >
          <div className="mx-auto max-w-[1350px] px-8 py-24">
            <div className="mb-12 text-center">
              <p className="text-[17px] font-bold text-[#4771A6]">
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
                  <a href={`/?service=${encodeURIComponent(service.title)}#garage-results`} key={service.title} className="group rounded-[28px] border border-[#EAECF0] bg-white p-8 text-left transition duration-300 hover:-translate-y-2 hover:border-[#4771A6]/40 hover:shadow-[0_22px_60px_rgba(16,24,40,0.12)]"
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

                    <p className="mt-8 text-[17px] font-bold text-[#4771A6]">
                      Find a garage →
                    </p>
                  </a>
                )
              )}
            </div>

            <div className="mt-10 text-center">
              <a href="#garage-results" className="text-[18px] font-semibold text-[#475467] transition hover:text-[#4771A6]">
                Browse available garages →
              </a>
            </div>
          </div>
        </section>

        {/* GARAGES */}

        <section id="garage-results" className="mx-auto max-w-[1350px] scroll-mt-28 px-8 py-24">
          <div className="mb-12 text-center">
            <p className="text-[17px] font-bold text-[#4771A6]">
              Available near you
            </p>

            <h2 className="mx-auto mt-3 max-w-[950px] text-[46px] font-bold tracking-[-0.04em] sm:text-[56px]">
              Garages ready to help.
            </h2>
          </div>

          <LiveGarages />
        </section>

        {/* GARAGE BUSINESS */}

        <section
          id="garages"
          className="mx-auto max-w-[1350px] px-8 pb-28"
        >
          <div className="overflow-hidden rounded-[36px] bg-[#101828] px-10 py-16 text-white lg:px-16 lg:py-20">
            <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-[17px] font-bold text-[#83A7D3]">
                  MECATREX for garages
                </p>

                <h2 className="mt-4 text-[48px] font-bold leading-[1.05] tracking-[-0.04em] sm:text-[60px]">
                  More customers.
                  <br />
                  Less chaos.
                </h2>

                <p className="mt-7 max-w-[570px] text-[20px] leading-9 text-white/65">
                  Manage appointments,
                  organize your shop
                  calendar and promote
                  seasonal offers from one
                  simple platform.
                </p>

                <Link href="/signup" className="mt-9 inline-flex rounded-xl bg-white px-7 py-4 text-[18px] font-bold text-[#101828] transition hover:bg-[#EDF3FA]">
                  Join MECATREX as a garage
                </Link>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-8">
                  <div className="text-[44px]">
                    📅
                  </div>

                  <p className="mt-8 text-[15px] font-bold tracking-wider text-[#83A7D3]">
                    CALENDAR
                  </p>

                  <h3 className="mt-3 text-[27px] font-bold">
                    One organized
                    calendar.
                  </h3>

                  <p className="mt-3 text-[18px] leading-8 text-white/60">
                    Organize appointments
                    and see garage capacity
                    at a glance.
                  </p>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-8">
                  <div className="text-[44px]">
                    📣
                  </div>

                  <p className="mt-8 text-[15px] font-bold tracking-wider text-[#83A7D3]">
                    PROMOTIONS
                  </p>

                  <h3 className="mt-3 text-[27px] font-bold">
                    Promote your deals.
                  </h3>

                  <p className="mt-3 text-[18px] leading-8 text-white/60">
                    Share seasonal
                    promotions directly
                    with nearby vehicle
                    owners.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}