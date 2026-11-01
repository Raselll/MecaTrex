"use client";

import { useState } from "react";
import { signup } from "./actions";

type AccountType = "client" | "provider";
type ProviderType = "garage" | "towing";

export default function SignupForm({ error }: { error?: string }) {
  const [accountType, setAccountType] = useState<AccountType>("client");
  const [providerType, setProviderType] = useState<ProviderType>("garage");

  return (
    <form action={signup} className="mt-8">
      <input type="hidden" name="account_type" value={accountType} />
      <input type="hidden" name="provider_type" value={providerType} />

      <div className="grid grid-cols-2 rounded-[18px] bg-[#F2F4F7] p-1.5">
        <button
          type="button"
          onClick={() => setAccountType("client")}
          className={`rounded-[14px] px-5 py-3.5 text-[15px] font-bold transition ${accountType === "client" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085]"}`}
        >
          Client
        </button>
        <button
          type="button"
          onClick={() => setAccountType("provider")}
          className={`rounded-[14px] px-5 py-3.5 text-[15px] font-bold transition ${accountType === "provider" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085]"}`}
        >
          Service provider
        </button>
      </div>

      {accountType === "provider" && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-[#667085]">I operate a</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProviderType("garage")}
              className={`rounded-[16px] border px-5 py-4 text-left transition ${providerType === "garage" ? "border-[#4771A6] bg-[#EDF3FA]" : "border-[#D0D5DD] bg-white"}`}
            >
              <div className="text-[25px]">🔧</div>
              <p className="mt-2 font-bold">Garage</p>
            </button>
            <button
              type="button"
              onClick={() => setProviderType("towing")}
              className={`rounded-[16px] border px-5 py-4 text-left transition ${providerType === "towing" ? "border-[#4771A6] bg-[#EDF3FA]" : "border-[#D0D5DD] bg-white"}`}
            >
              <div className="text-[25px]">🚛</div>
              <p className="mt-2 font-bold">Towing service</p>
            </button>
          </div>
        </div>
      )}

      {error && <div className="mt-5 rounded-[15px] bg-[#FEF3F2] px-4 py-3 text-[14px] font-semibold text-[#B42318]">{error}</div>}

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="First name" name="first_name" autoComplete="given-name" required />
        <Field label="Last name" name="last_name" autoComplete="family-name" required />
        <Field label="Email" name="email" type="email" autoComplete="email" required className="sm:col-span-2" />
        <Field label="Primary phone" name="primary_phone" type="tel" autoComplete="tel" required />
        <Field label="Secondary phone" name="secondary_phone" type="tel" placeholder="Optional" />
      </div>

      {accountType === "provider" && (
        <div className="mt-8 border-t border-[#EAECF0] pt-7">
          <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#4771A6]">Business information</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field
              label={providerType === "garage" ? "Garage name" : "Towing company name"}
              name="business_name"
              required
              className="sm:col-span-2"
            />
            <Field
              label={providerType === "garage" ? "Garage address" : "Business / dispatch address"}
              name="business_address"
              autoComplete="street-address"
              required
              className="sm:col-span-2"
            />
            <Field label="City" name="business_city" autoComplete="address-level2" required />
            <Field label="Province / State" name="business_province" autoComplete="address-level1" required />
            <Field label="Postal / ZIP code" name="business_postal_code" autoComplete="postal-code" required />
          </div>
          <div className="mt-5 rounded-[16px] bg-[#EDF3FA] p-4">
            <p className="text-[14px] leading-6 text-[#475467]">Provider accounts are reviewed by MECATREX before they can appear publicly or accept bookings.</p>
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-[#EAECF0] pt-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <Field label="Confirm password" name="confirm_password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <p className="mt-2 text-[12px] text-[#98A2B3]">Minimum 8 characters.</p>
      </div>

      <label className="mt-7 flex cursor-pointer items-start gap-3 text-[13px] leading-5 text-[#667085]">
        <input type="checkbox" required className="mt-1 h-4 w-4" />
        <span>I agree to the MECATREX Terms of Service and Privacy Policy.</span>
      </label>

      <button type="submit" className="mt-7 w-full rounded-[15px] bg-[#4771A6] px-6 py-4 text-[16px] font-bold text-white transition hover:bg-[#3C6190]">
        {accountType === "client" ? "Create client account" : "Submit provider application"}
      </button>
    </form>
  );
}

function Field({
  label,
  className = "",
  ...props
}: {
  label: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={className}>
      <span className="mb-2 block text-[13px] font-bold text-[#344054]">{label}</span>
      <input
        {...props}
        className="h-[55px] w-full rounded-[15px] border border-[#D0D5DD] bg-white px-4 text-[16px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
      />
    </label>
  );
}
