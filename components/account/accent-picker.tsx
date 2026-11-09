
"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ACCENT_COLORS,
  type AccentColor,
} from "@/lib/booking";

type Props = {
  userId: string;
  initialAccent: AccentColor;
  compact?: boolean;
};

export default function AccentPicker({
  userId,
  initialAccent,
  compact = false,
}: Props) {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [selected, setSelected] =
    useState<AccentColor>(initialAccent);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function choose(color: AccentColor) {
    if (saving || color === selected) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ accent_color: color })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      setMessage(
        "The theme could not be saved. Please retry."
      );
      return;
    }

    setSelected(color);

    document
      .querySelectorAll<HTMLElement>(
        "[data-portal-theme]"
      )
      .forEach((element) => {
        element.dataset.portalTheme = color;
      });

    setMessage(
      `${ACCENT_COLORS[color].name} selected`
    );
  }

  return (
    <div
      className={
        compact
          ? "flex flex-col items-start gap-2 sm:items-end"
          : "portal-theme-picker mt-6 rounded-[20px] border border-[#D5DFEA] bg-white p-5"
      }
      aria-label="Dashboard theme selection"
    >
      <div
        className={
          compact
            ? "flex items-center gap-2"
            : "flex flex-wrap items-center justify-between gap-4"
        }
      >
        <div className={compact ? "hidden" : ""}>
          <h3 className="text-[16px] font-extrabold text-[#101828]">
            🎨 Make this portal yours
          </h3>

          <p className="mt-1 text-[13px] text-[#667085]">
            Choose your dashboard accent color.
          </p>
        </div>

        {compact && (
          <span
            className="mr-1 text-[16px]"
            aria-hidden="true"
            title="Theme"
          >
            🎨
          </span>
        )}

        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Choose a theme"
        >
          {(
            Object.entries(ACCENT_COLORS) as [
              AccentColor,
              {
                name: string;
                hex: string;
                soft: string;
              }
            ][]
          ).map(([name, color]) => (
            <button
              key={name}
              type="button"
              title={color.name}
              aria-label={color.name}
              aria-pressed={selected === name}
              disabled={saving}
              onClick={() => void choose(name)}
              style={{
                backgroundColor: color.hex,
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white text-[15px] font-extrabold text-white shadow-sm transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${
                selected === name
                  ? "ring-[3px] ring-[#101828]"
                  : "ring-1 ring-[#D0D5DD]"
              }`}
            >
              {selected === name ? "✓" : ""}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <p
          role="status"
          className="text-[11px] font-semibold text-[#475467]"
        >
          {message}
        </p>
      )}
    </div>
  );
}
