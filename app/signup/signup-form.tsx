"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signup } from "./actions";

type AccountType = "client" | "provider";
type ProviderType = "garage" | "towing";

type AddressSuggestion = {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
};

type AddressDetails = {
  placeId: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  formattedAddress: string;
};

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function Requirement({ met, active, children }: { met: boolean; active: boolean; children: React.ReactNode }) {
  const icon = !active ? "•" : met ? "✓" : "×";
  const color = !active ? "text-[#98A2B3]" : met ? "text-[#027A48]" : "text-[#B42318]";

  return (
    <li className={`flex items-center gap-2 text-[12px] font-medium ${color}`}>
      <span className="inline-flex w-3 justify-center font-bold">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

export default function SignupForm({ error }: { error?: string }) {
  const [accountType, setAccountType] = useState<AccountType>("client");
  const [providerType, setProviderType] = useState<ProviderType>("garage");

  const [primaryPhone, setPrimaryPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPostalCode, setBusinessPostalCode] = useState("");
  const [businessPlaceId, setBusinessPlaceId] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressMessage, setAddressMessage] = useState("");
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const addressRequestId = useRef(0);

  useEffect(() => {
    setSessionToken(crypto.randomUUID());
  }, []);

  const primaryPhoneValid = PHONE_REGEX.test(primaryPhone);
  const secondaryPhoneValid = secondaryPhone === "" || PHONE_REGEX.test(secondaryPhone);

  const passwordRequirements = useMemo(
    () => ({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    }),
    [password]
  );

  const passwordValid =
    passwordRequirements.length &&
    passwordRequirements.uppercase &&
    passwordRequirements.special;

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const signupReady =
    primaryPhoneValid &&
    secondaryPhoneValid &&
    passwordValid &&
    passwordsMatch;

  useEffect(() => {
    if (accountType !== "provider") {
      setAddressSuggestions([]);
      setAddressDropdownOpen(false);
      return;
    }

    const query = businessAddress.trim();
    if (query.length < 3 || businessPlaceId) {
      setAddressSuggestions([]);
      setAddressDropdownOpen(false);
      return;
    }

    const requestId = ++addressRequestId.current;
    const timer = window.setTimeout(async () => {
      setAddressLoading(true);
      setAddressMessage("");

      try {
        const response = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(query)}&sessionToken=${encodeURIComponent(sessionToken)}`,
          { cache: "no-store" }
        );

        if (requestId !== addressRequestId.current) return;

        if (response.status === 503) {
          setAddressSuggestions([]);
          setAddressDropdownOpen(false);
          setAddressMessage("Address suggestions will activate after the Google Places API key is configured.");
          return;
        }

        if (!response.ok) throw new Error("Address lookup failed");

        const data = (await response.json()) as { suggestions: AddressSuggestion[] };
        setAddressSuggestions(data.suggestions ?? []);
        setAddressDropdownOpen((data.suggestions ?? []).length > 0);
      } catch {
        if (requestId !== addressRequestId.current) return;
        setAddressSuggestions([]);
        setAddressDropdownOpen(false);
        setAddressMessage("Address suggestions are temporarily unavailable. You can continue typing the address manually.");
      } finally {
        if (requestId === addressRequestId.current) setAddressLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [accountType, businessAddress, businessPlaceId, sessionToken]);

  async function chooseAddress(suggestion: AddressSuggestion) {
    setAddressLoading(true);
    setAddressDropdownOpen(false);
    setAddressMessage("");

    try {
      const response = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(suggestion.placeId)}&sessionToken=${encodeURIComponent(sessionToken)}`,
        { cache: "no-store" }
      );

      const data = (await response.json()) as AddressDetails & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not validate this address");

      setBusinessAddress(data.streetAddress || suggestion.mainText);
      setBusinessPostalCode(data.postalCode || "");
      setBusinessPlaceId(data.placeId);
      setAddressSuggestions([]);
      setAddressMessage("Address verified in Montreal, Quebec.");
      setSessionToken(crypto.randomUUID());
    } catch (selectionError) {
      setBusinessPlaceId("");
      setAddressMessage(
        selectionError instanceof Error
          ? selectionError.message
          : "Please select a Montreal address."
      );
    } finally {
      setAddressLoading(false);
    }
  }

  return (
    <form action={signup} className="mt-8">
      <input type="hidden" name="account_type" value={accountType} />
      <input type="hidden" name="provider_type" value={providerType} />
      <input type="hidden" name="business_place_id" value={businessPlaceId} />

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

      {error && (
        <div className="mt-5 rounded-[15px] bg-[#FEF3F2] px-4 py-3 text-[14px] font-semibold text-[#B42318]">
          {error}
        </div>
      )}

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="First name" name="first_name" autoComplete="given-name" required />
        <Field label="Last name" name="last_name" autoComplete="family-name" required />
        <Field label="Email" name="email" type="email" autoComplete="email" required className="sm:col-span-2" />

        <PhoneField
          label="Primary phone"
          name="primary_phone"
          value={primaryPhone}
          onChange={setPrimaryPhone}
          required
        />

        <PhoneField
          label="Secondary phone"
          name="secondary_phone"
          value={secondaryPhone}
          onChange={setSecondaryPhone}
          optional
        />
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

            <div className="relative sm:col-span-2">
              <label>
                <span className="mb-2 block text-[13px] font-bold text-[#344054]">
                  {providerType === "garage" ? "Garage address" : "Business / dispatch address"}
                </span>
                <div className="relative">
                  <input
                    name="business_address"
                    value={businessAddress}
                    onChange={(event) => {
                      setBusinessAddress(event.target.value);
                      setBusinessPlaceId("");
                      setAddressMessage("");
                    }}
                    onFocus={() => addressSuggestions.length > 0 && setAddressDropdownOpen(true)}
                    autoComplete="off"
                    required
                    placeholder="Start typing a Montreal address"
                    className="h-[55px] w-full rounded-[15px] border border-[#D0D5DD] bg-white px-4 pr-11 text-[16px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
                  />
                  {addressLoading && (
                    <span className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[#D0D5DD] border-t-[#4771A6]" />
                  )}
                </div>
              </label>

              {addressDropdownOpen && addressSuggestions.length > 0 && (
                <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-[16px] border border-[#E4E7EC] bg-white shadow-[0_18px_55px_rgba(16,24,40,0.15)]">
                  {addressSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.placeId}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => chooseAddress(suggestion)}
                      className="block w-full border-b border-[#F2F4F7] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#F8FAFC]"
                    >
                      <p className="text-[14px] font-bold text-[#101828]">{suggestion.mainText}</p>
                      <p className="mt-0.5 text-[12px] text-[#667085]">{suggestion.secondaryText || suggestion.text}</p>
                    </button>
                  ))}

                  <div className="flex justify-end bg-[#F9FAFB] px-4 py-2">
                    {/* Google requires attribution when Places predictions are displayed without a map. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                      alt="Powered by Google"
                      className="h-[14px] w-auto"
                    />
                  </div>
                </div>
              )}

              {addressMessage && (
                <p
                  className={`mt-2 text-[12px] font-medium ${businessPlaceId ? "text-[#027A48]" : "text-[#667085]"}`}
                  aria-live="polite"
                >
                  {addressMessage}
                </p>
              )}
            </div>

            <Field
              label="City"
              name="business_city"
              value="Montreal"
              readOnly
              required
              className="opacity-90"
            />

            <Field
              label="Province"
              name="business_province"
              value="Quebec"
              readOnly
              required
              className="opacity-90"
            />

            <label>
              <span className="mb-2 block text-[13px] font-bold text-[#344054]">Postal code</span>
              <input
                name="business_postal_code"
                value={businessPostalCode}
                onChange={(event) => setBusinessPostalCode(event.target.value.toUpperCase())}
                autoComplete="postal-code"
                required
                placeholder="H2X 1Y4"
                className="h-[55px] w-full rounded-[15px] border border-[#D0D5DD] bg-white px-4 text-[16px] uppercase text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
              />
            </label>
          </div>

          <div className="mt-5 rounded-[16px] bg-[#EDF3FA] p-4">
            <p className="text-[14px] leading-6 text-[#475467]">
              MECATREX is launching in Montreal first. Provider accounts are reviewed before they can appear publicly or accept bookings.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-[#EAECF0] pt-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <label>
            <span className="mb-2 block text-[13px] font-bold text-[#344054]">Password</span>
            <input
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              aria-invalid={password.length > 0 && !passwordValid}
              className={`h-[55px] w-full rounded-[15px] border bg-white px-4 text-[16px] text-[#101828] outline-none transition focus:ring-4 ${
                password.length > 0 && !passwordValid
                  ? "border-[#FDA29B] focus:border-[#D92D20] focus:ring-[#D92D20]/10"
                  : "border-[#D0D5DD] focus:border-[#4771A6] focus:ring-[#4771A6]/10"
              }`}
            />

            <ul className="mt-2 space-y-1" aria-live="polite">
              <Requirement met={passwordRequirements.length} active={password.length > 0}>At least 8 characters</Requirement>
              <Requirement met={passwordRequirements.uppercase} active={password.length > 0}>At least 1 uppercase letter</Requirement>
              <Requirement met={passwordRequirements.special} active={password.length > 0}>At least 1 special character</Requirement>
            </ul>
          </label>

          <label>
            <span className="mb-2 block text-[13px] font-bold text-[#344054]">Confirm password</span>
            <input
              name="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
              className={`h-[55px] w-full rounded-[15px] border bg-white px-4 text-[16px] text-[#101828] outline-none transition focus:ring-4 ${
                confirmPassword.length > 0 && !passwordsMatch
                  ? "border-[#FDA29B] focus:border-[#D92D20] focus:ring-[#D92D20]/10"
                  : passwordsMatch
                    ? "border-[#6CE9A6] focus:border-[#12B76A] focus:ring-[#12B76A]/10"
                    : "border-[#D0D5DD] focus:border-[#4771A6] focus:ring-[#4771A6]/10"
              }`}
            />

            {confirmPassword.length > 0 && (
              <p
                className={`mt-2 text-[12px] font-semibold ${passwordsMatch ? "text-[#027A48]" : "text-[#B42318]"}`}
                aria-live="polite"
              >
                {passwordsMatch ? "✓ Passwords match" : "× Passwords do not match"}
              </p>
            )}
          </label>
        </div>
      </div>

      <label className="mt-7 flex cursor-pointer items-start gap-3 text-[13px] leading-5 text-[#667085]">
        <input type="checkbox" required className="mt-1 h-4 w-4" />
        <span>I agree to the MECATREX Terms of Service and Privacy Policy.</span>
      </label>

      <button
        type="submit"
        disabled={!signupReady}
        className="mt-7 w-full rounded-[15px] bg-[#4771A6] px-6 py-4 text-[16px] font-bold text-white transition hover:bg-[#3C6190] disabled:cursor-not-allowed disabled:bg-[#B8C6D8] disabled:hover:bg-[#B8C6D8]"
      >
        {accountType === "client" ? "Create client account" : "Submit provider application"}
      </button>
    </form>
  );
}

function PhoneField({
  label,
  name,
  value,
  onChange,
  required = false,
  optional = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  optional?: boolean;
}) {
  const valid = value === "" ? !required : PHONE_REGEX.test(value);
  const active = value.length > 0;

  return (
    <label>
      <span className="mb-2 block text-[13px] font-bold text-[#344054]">
        {label} {optional && <span className="font-medium text-[#98A2B3]">(optional)</span>}
      </span>
      <input
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete={required ? "tel" : "off"}
        value={value}
        onChange={(event) => onChange(formatPhone(event.target.value))}
        maxLength={12}
        required={required}
        placeholder="514-555-1234"
        aria-invalid={active && !valid}
        className={`h-[55px] w-full rounded-[15px] border bg-white px-4 text-[16px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:ring-4 ${
          active && !valid
            ? "border-[#FDA29B] focus:border-[#D92D20] focus:ring-[#D92D20]/10"
            : active && valid
              ? "border-[#6CE9A6] focus:border-[#12B76A] focus:ring-[#12B76A]/10"
              : "border-[#D0D5DD] focus:border-[#4771A6] focus:ring-[#4771A6]/10"
        }`}
      />
      <p className={`mt-2 text-[12px] font-medium ${active && !valid ? "text-[#B42318]" : "text-[#98A2B3]"}`}>
        {active && !valid ? "Enter exactly 10 digits." : "Format: 514-555-1234"}
      </p>
    </label>
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
        className={`h-[55px] w-full rounded-[15px] border border-[#D0D5DD] px-4 text-[16px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10 ${props.readOnly ? "cursor-default bg-[#F8FAFC] text-[#667085]" : "bg-white"}`}
      />
    </label>
  );
}
