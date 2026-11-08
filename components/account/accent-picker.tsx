"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCENT_COLORS, type AccentColor } from "@/lib/booking";

export default function AccentPicker({ userId, initialAccent }: { userId: string; initialAccent: AccentColor }) {
  const supabase = useMemo(() => createClient(), []);
  const [selected, setSelected] = useState<AccentColor>(initialAccent);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const current = ACCENT_COLORS[selected] ?? ACCENT_COLORS.blue;

  async function choose(color: AccentColor) {
    if (color === selected || saving) return;
    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("profiles").update({ accent_color: color }).eq("id", userId);
    setSaving(false);
    if (error) setMessage("Color not saved. Apply the latest database migration first.");
    else {
      setSelected(color);
      document.querySelectorAll<HTMLElement>("[data-portal-theme]").forEach((element) => {
        element.dataset.portalTheme = color;
      });
      setMessage("Theme saved and applied throughout your dashboard.");
    }
  }

  return (
    <div className="mt-6 rounded-[20px] border border-[#D5DFEA] bg-white p-5 portal-theme-picker" style={{ borderTop: `5px solid ${current.hex}` }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-[16px] font-extrabold text-[#101828]">🎨 Make this portal yours</h3>
          <p className="mt-1 text-[13px] leading-5 text-[#667085]">Choose your dashboard theme. Cards, buttons and backgrounds update while text stays readable.</p>
        </div>
        <div className="flex items-center gap-3" role="group" aria-label="Choose your portal accent color">
          {(Object.entries(ACCENT_COLORS) as [AccentColor, { name: string; hex: string; soft: string }][]).map(([name, color]) => (
            <button type="button" key={name} disabled={saving} onClick={() => void choose(name)}
              aria-label={color.name} aria-pressed={selected === name} title={color.name}
              style={{ backgroundColor: color.hex }}
              className={`flex h-10 w-10 items-center justify-center rounded-full border-[3px] text-[16px] font-bold text-white transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60 ${selected === name ? "border-white ring-[3px] ring-[#101828]" : "border-white ring-1 ring-[#D0D5DD]"}`}>{selected === name ? "✓" : ""}</button>
          ))}
        </div>
      </div>
      {message && <p role="status" className="mt-3 text-[12px] font-semibold text-[#475467]">{message}</p>}
    </div>
  );
}
