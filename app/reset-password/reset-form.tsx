"use client";

import { useState } from "react";
import { updatePassword } from "./actions";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const rules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "At least 1 uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "At least 1 special character", ok: /[^A-Za-z0-9\s]/.test(password) },
  ];
  const matches = Boolean(confirmation) && confirmation === password;
  const ready = rules.every((rule) => rule.ok) && matches;

  return (
    <form action={updatePassword} className="mt-7 space-y-5">
      <label className="block">
        <span className="mb-2 block text-[14px] font-bold text-[#101828]">New password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="h-[54px] w-full rounded-[14px] border border-[#98A2B3] bg-white px-4 text-[16px] outline-none focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10" />
      </label>
      <ul className="space-y-1" aria-live="polite">
        {rules.map((rule) => (
          <li key={rule.label} className={`text-[13px] font-semibold ${rule.ok ? "text-[#027A48]" : "text-[#667085]"}`}>
            {rule.ok ? "✓" : "○"} {rule.label}
          </li>
        ))}
      </ul>
      <label className="block">
        <span className="mb-2 block text-[14px] font-bold text-[#101828]">Confirm new password</span>
        <input name="confirm_password" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={`h-[54px] w-full rounded-[14px] border px-4 text-[16px] outline-none focus:ring-4 ${confirmation ? matches ? "border-[#12B76A] focus:ring-[#12B76A]/10" : "border-[#F04438] focus:ring-[#F04438]/10" : "border-[#98A2B3] focus:ring-[#4771A6]/10"}`} />
        {confirmation && <span role="status" className={`mt-2 block text-[13px] font-semibold ${matches ? "text-[#027A48]" : "text-[#B42318]"}`}>{matches ? "✓ Passwords match" : "Passwords do not match yet"}</span>}
      </label>
      <button disabled={!ready} type="submit" className="w-full rounded-[14px] bg-[#4771A6] px-5 py-4 text-[16px] font-bold text-white hover:bg-[#315C91] disabled:cursor-not-allowed disabled:opacity-40">Save new password</button>
    </form>
  );
}
