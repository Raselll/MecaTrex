
"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { signup } from "./actions";
import { WEEKDAYS } from "@/lib/booking";
import { validateBusinessHours } from "@/lib/business-hours";
import ServiceCategorySelector from "@/components/services/service-category-selector";

type AccountType = "client" | "provider";
type ProviderType = "garage" | "towing";

type Suggestion = {
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
  latitude: number | null;
  longitude: number | null;
};

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;

const inputClass =
  "h-[52px] w-full rounded-[13px] border border-[#D0D5DD] bg-white px-4 text-[14px] text-[#101828] outline-none transition focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10";

function formatPhone(text: string) {
  const digits = text.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[12px] font-bold text-[#344054]">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextField({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
}) {
  return (
    <div className={className}>
      <Field label={label}>
        <input
          {...props}
          className={`${inputClass} ${
            props.readOnly ? "bg-[#F2F4F7] text-[#667085]" : ""
          }`}
        />
      </Field>
    </div>
  );
}

function PhoneInput({
  name,
  label,
  value,
  onChange,
  required,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        name={name}
        type="tel"
        value={value}
        onChange={(event) => onChange(formatPhone(event.target.value))}
        required={required}
        maxLength={12}
        placeholder="514-555-1234"
        className={inputClass}
      />
    </Field>
  );
}

export default function SignupForm({
  error,
  next,
}: {
  error?: string;
  next?: string;
}) {
  const [state, action, pending] = useActionState(signup, {
    error: error ?? null,
  });

  const [accountType, setAccountType] = useState<AccountType>("client");
  const [providerType, setProviderType] = useState<ProviderType>("garage");

  const [primaryPhone, setPrimaryPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPostalCode, setBusinessPostalCode] = useState("");
  const [businessNEQ, setBusinessNEQ] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");

  const [applicationDescription, setApplicationDescription] =
    useState("");

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [otherServiceEnabled, setOtherServiceEnabled] = useState(false);
  const [otherService, setOtherService] = useState("");

  const [businessPlaceId, setBusinessPlaceId] = useState("");
  const [businessLatitude, setBusinessLatitude] = useState<number | null>(
    null
  );
  const [businessLongitude, setBusinessLongitude] = useState<number | null>(
    null
  );

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressMessage, setAddressMessage] = useState("");
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const addressRequestId = useRef(0);

  const [businessHours, setBusinessHours] = useState(() =>
    WEEKDAYS.map((_, weekday) => ({
      weekday,
      is_open: false,
      open_time: "09:00",
      close_time: "17:00",
    }))
  );
  const [hoursError, setHoursError] = useState("");

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    setSessionToken(crypto.randomUUID());
  }, []);

  useEffect(() => {
    if (!photo) return;

    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    if (accountType !== "provider") return;

    const query = businessAddress.trim();

    if (query.length < 3 || businessPlaceId) return;

    const requestId = ++addressRequestId.current;

    const timer = window.setTimeout(async () => {
      setAddressLoading(true);

      try {
        const response = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(query)}&sessionToken=${encodeURIComponent(sessionToken)}`,
          { cache: "no-store" }
        );

        if (requestId !== addressRequestId.current) return;

        if (response.status === 503) {
          setAddressMessage(
            "Address suggestions are not configured yet."
          );
          return;
        }

        if (!response.ok) {
          throw new Error("Address search failed.");
        }

        const result = (await response.json()) as {
          suggestions: Suggestion[];
        };

        setSuggestions(result.suggestions ?? []);
        setAddressDropdownOpen(true);
      } catch {
        if (requestId === addressRequestId.current) {
          setSuggestions([]);
          setAddressMessage("Address lookup is unavailable.");
        }
      } finally {
        if (requestId === addressRequestId.current) {
          setAddressLoading(false);
        }
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [accountType, businessAddress, businessPlaceId, sessionToken]);

  async function chooseAddress(suggestion: Suggestion) {
    setAddressLoading(true);
    setAddressDropdownOpen(false);

    try {
      const response = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(suggestion.placeId)}&sessionToken=${encodeURIComponent(sessionToken)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Could not verify the address.");
      }

      const result = (await response.json()) as AddressDetails;

      setBusinessAddress(result.streetAddress || suggestion.mainText);
      setBusinessPostalCode(result.postalCode || "");
      setBusinessPlaceId(result.placeId);
      setBusinessLatitude(result.latitude ?? null);
      setBusinessLongitude(result.longitude ?? null);
      setAddressMessage("✓ Address verified in Montreal.");
      setSuggestions([]);
      setSessionToken(crypto.randomUUID());
    } catch {
      setAddressMessage("Please select a valid Montreal address.");
      setBusinessPlaceId("");
    } finally {
      setAddressLoading(false);
    }
  }

  function changeHour(
    weekday: number,
    changes: Partial<(typeof businessHours)[number]>
  ) {
    setBusinessHours((current) =>
      current.map((entry) =>
        entry.weekday === weekday
          ? { ...entry, ...changes }
          : entry
      )
    );
    setHoursError("");
  }

  function toggleService(name: string) {
    setSelectedServices((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name]
    );
  }

  function changePhoto(file: File | null) {
    setPhotoError("");
    setPhotoPreview("");

    if (!file) {
      setPhoto(null);
      return;
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setPhotoError("Use JPG, PNG or WebP.");
      setPhoto(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Maximum image size is 5 MB.");
      setPhoto(null);
      return;
    }

    setPhoto(file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (accountType !== "provider") return;

    if (!photo) {
      event.preventDefault();
      setPhotoError("A business photo is required.");
      document.getElementById("business-photo")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    if (!validateBusinessHours(businessHours)) {
      event.preventDefault();
      setHoursError("Check your business hours.");
      document.getElementById("business-hours")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  const applicationServices = [
    ...selectedServices,
    ...(otherServiceEnabled && otherService.trim()
      ? [otherService.trim()]
      : []),
  ];

  const passwordValid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password);

  const signupReady =
    PHONE_REGEX.test(primaryPhone) &&
    (!secondaryPhone || PHONE_REGEX.test(secondaryPhone)) &&
    passwordValid &&
    password === confirmPassword &&
    (accountType === "client" ||
      (Boolean(photo) &&
        /^\d{10}$/.test(businessNEQ) &&
        PHONE_REGEX.test(businessPhone) &&
        applicationDescription.trim().length >= 30 &&
        applicationServices.length > 0 &&
        (!otherServiceEnabled || Boolean(otherService.trim()))));

  return (
    <form action={action} onSubmit={handleSubmit} className="mt-7">
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="account_type" value={accountType} />
      <input type="hidden" name="provider_type" value={providerType} />
      <input type="hidden" name="business_place_id" value={businessPlaceId} />
      <input
        type="hidden"
        name="business_latitude"
        value={businessLatitude ?? ""}
      />
      <input
        type="hidden"
        name="business_longitude"
        value={businessLongitude ?? ""}
      />
      <input
        type="hidden"
        name="application_services"
        value={JSON.stringify(applicationServices)}
      />
      <input
        type="hidden"
        name="business_hours"
        value={JSON.stringify(businessHours)}
      />

      <div className="grid grid-cols-2 rounded-[16px] bg-[#F2F4F7] p-1">
        {(["client", "provider"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setAccountType(type)}
            className={`rounded-[12px] px-4 py-3 text-[13px] font-bold ${
              accountType === type
                ? "bg-white text-[#101828] shadow-sm"
                : "text-[#667085]"
            }`}
          >
            {type === "client" ? "Client" : "Service provider"}
          </button>
        ))}
      </div>

      {accountType === "provider" && (
        <div className="mt-5">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#667085]">
            I operate a
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["garage", "towing"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setProviderType(type);
                  setSelectedServices([]);
                  setOtherServiceEnabled(false);
                  setOtherService("");
                }}
                className={`rounded-[15px] border p-4 text-left ${
                  providerType === type
                    ? "border-[#4771A6] bg-[#EDF3FA]"
                    : "border-[#D0D5DD] bg-white"
                }`}
              >
                <span className="text-[23px]">
                  {type === "garage" ? "🔧" : "🚛"}
                </span>
                <p className="mt-2 text-[13px] font-bold">
                  {type === "garage" ? "Garage" : "Towing service"}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {(state.error || hoursError || photoError) && (
        <div
          role="alert"
          className="mt-5 rounded-[13px] bg-[#FEF3F2] p-4 text-[13px] font-semibold text-[#B42318]"
        >
          {state.error || hoursError || photoError}
        </div>
      )}

      <section className="mt-7 grid gap-4 sm:grid-cols-2">
        <TextField
          label="First name *"
          name="first_name"
          autoComplete="given-name"
          required
        />
        <TextField
          label="Last name *"
          name="last_name"
          autoComplete="family-name"
          required
        />
        <TextField
          label="Email *"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="sm:col-span-2"
        />
        <PhoneInput
          label="Primary phone *"
          name="primary_phone"
          value={primaryPhone}
          onChange={setPrimaryPhone}
          required
        />
        <PhoneInput
          label="Secondary phone (optional)"
          name="secondary_phone"
          value={secondaryPhone}
          onChange={setSecondaryPhone}
        />
      </section>

      {accountType === "provider" && (
        <section className="mt-8 space-y-6 border-t border-[#EAECF0] pt-7">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">
              Business information
            </p>
            <h3 className="mt-2 text-[20px] font-extrabold">
              Tell us about your business
            </h3>
          </div>

          <TextField
            label={
              providerType === "garage"
                ? "Garage name *"
                : "Towing company name *"
            }
            name="business_name"
            required
          />

          <div className="relative">
            <Field label="Business / dispatch address *">
              <input
                name="business_address"
                value={businessAddress}
                required
                autoComplete="off"
                placeholder="Start typing a Montreal address"
                className={inputClass}
                onChange={(event) => {
                  setBusinessAddress(event.target.value);
                  setBusinessPlaceId("");
                  setBusinessLatitude(null);
                  setBusinessLongitude(null);
                  setSuggestions([]);
                  setAddressMessage("");
                }}
                onFocus={() => setAddressDropdownOpen(true)}
              />
            </Field>

            {addressLoading && (
              <p className="mt-2 text-[12px] text-[#667085]">
                Searching addresses...
              </p>
            )}

            {addressDropdownOpen && suggestions.length > 0 && (
              <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-[15px] border border-[#D0D5DD] bg-white shadow-xl">
                {suggestions.map((item) => (
                  <button
                    key={item.placeId}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void chooseAddress(item)}
                    className="block w-full border-b border-[#EAECF0] p-3 text-left hover:bg-[#F8FAFC]"
                  >
                    <strong className="text-[13px]">
                      {item.mainText}
                    </strong>
                    <p className="text-[11px] text-[#667085]">
                      {item.secondaryText || item.text}
                    </p>
                  </button>
                ))}
                <div className="bg-[#F9FAFB] p-2 text-right">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                    alt="Powered by Google"
                    className="ml-auto h-[14px] w-auto"
                  />
                </div>
              </div>
            )}

            {addressMessage && (
              <p className="mt-2 text-[12px] text-[#4771A6]">
                {addressMessage}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="City"
              name="business_city"
              value="Montreal"
              readOnly
              required
            />
            <TextField
              label="Province"
              name="business_province"
              value="Quebec"
              readOnly
              required
            />
            <TextField
              label="Postal code *"
              name="business_postal_code"
              value={businessPostalCode}
              onChange={(event) =>
                setBusinessPostalCode(event.target.value.toUpperCase())
              }
              required
            />
          </div>

          <div
            id="business-photo"
            className="scroll-mt-20 rounded-[20px] border border-[#B7CDE4] bg-[#F7FAFE] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-extrabold text-[#101828]">
                  📸 Business photo *
                </h3>
                <p className="mt-1 text-[12px] text-[#667085]">
                  Required for verification and your public listing.
                </p>
              </div>
              <span className="rounded-full bg-[#E4ECF8] px-3 py-1 text-[11px] font-bold text-[#315C91]">
                Required
              </span>
            </div>

            <div
              className="mt-4 aspect-video overflow-hidden rounded-[14px] border border-[#D0D5DD] bg-[#EAF1F8]"
              style={
                photoPreview
                  ? {
                      backgroundImage: `url("${photoPreview}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              {!photoPreview && (
                <div className="flex h-full flex-col items-center justify-center text-[#667085]">
                  <span className="text-[35px]">🏢</span>
                  <p className="mt-2 text-[13px] font-semibold">
                    Your business photo preview
                  </p>
                  <p className="mt-1 text-[11px]">
                    Recommended 1600 × 900 (16:9)
                  </p>
                </div>
              )}
            </div>

            <label className="mt-4 block cursor-pointer rounded-[12px] border border-[#4771A6] bg-white px-4 py-3 text-center text-[13px] font-bold text-[#315C91]">
              {photo ? "Change business photo" : "Upload business photo"}
              <input
                name="business_photo"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) =>
                  changePhoto(event.target.files?.[0] ?? null)
                }
              />
            </label>

            <p className="mt-2 text-center text-[11px] text-[#667085]">
              JPG, PNG or WebP · Maximum 5 MB
            </p>
            {photo && (
              <p className="mt-2 break-all text-center text-[12px] font-semibold text-[#027A48]">
                ✓ {photo.name}
              </p>
            )}
          </div>

          <div className="rounded-[20px] border border-[#D6E0ED] bg-[#F8FAFD] p-5">
            <h3 className="text-[17px] font-extrabold">
              Business verification
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Quebec enterprise number (NEQ) *">
                <input
                  name="business_neq"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={businessNEQ}
                  onChange={(event) =>
                    setBusinessNEQ(
                      event.target.value.replace(/\D/g, "").slice(0, 10)
                    )
                  }
                  className={inputClass}
                  placeholder="1234567890"
                />
              </Field>
              <PhoneInput
                label="Business phone *"
                name="business_phone"
                value={businessPhone}
                onChange={setBusinessPhone}
                required
              />
            </div>

            <div className="mt-4">
              <Field label="Business website (optional)">
                <input
                  name="business_website"
                  value={businessWebsite}
                  onChange={(event) =>
                    setBusinessWebsite(event.target.value)
                  }
                  placeholder="https://yourgarage.ca"
                  className={inputClass}
                />
              </Field>
            </div>

            <ServiceCategorySelector
              key={providerType}
              providerType={providerType}
              selectedServices={selectedServices}
              onToggleService={toggleService}
              otherServiceEnabled={otherServiceEnabled}
              onToggleOther={() => {
                setOtherServiceEnabled((current) => !current);
                setOtherService("");
              }}
              otherService={otherService}
              onOtherServiceChange={setOtherService}
            />

            <div className="mt-5">
              <Field label="Describe your business and services *">
                <textarea
                  name="application_description"
                  required
                  minLength={30}
                  maxLength={1500}
                  rows={4}
                  value={applicationDescription}
                  onChange={(event) =>
                    setApplicationDescription(event.target.value)
                  }
                  className="w-full rounded-[13px] border border-[#D0D5DD] bg-white p-4 text-[13px] outline-none focus:border-[#4771A6]"
                  placeholder="Tell us about your experience, specialties and equipment."
                />
              </Field>
              <p className="mt-1 text-[11px] text-[#667085]">
                {applicationDescription.length}/1500 characters
              </p>
            </div>
          </div>

          <div
            id="business-hours"
            className="scroll-mt-20 rounded-[20px] border border-[#D6E0ED] bg-[#F8FAFC] p-5"
          >
            <h3 className="text-[17px] font-extrabold">
              🕒 Your business hours
            </h3>
            <p className="mt-1 text-[12px] text-[#667085]">
              These hours will automatically appear in your
              business dashboard.
            </p>

            <div className="mt-4 space-y-2">
              {WEEKDAYS.map((day, weekday) => {
                const hour = businessHours[weekday];

                return (
                  <div
                    key={day}
                    className="grid gap-3 rounded-[12px] border border-[#E4E7EC] bg-white p-3 sm:grid-cols-[110px_1fr_1fr] sm:items-center"
                  >
                    <label className="flex items-center gap-2 text-[12px] font-bold">
                      <input
                        type="checkbox"
                        checked={hour.is_open}
                        onChange={(event) =>
                          changeHour(weekday, {
                            is_open: event.target.checked,
                          })
                        }
                      />
                      {day}
                    </label>
                    <Field label="Open">
                      <input
                        type="time"
                        step={1800}
                        value={hour.open_time}
                        disabled={!hour.is_open}
                        onChange={(event) =>
                          changeHour(weekday, {
                            open_time: event.target.value,
                          })
                        }
                        className={`${inputClass} disabled:opacity-40`}
                      />
                    </Field>
                    <Field label="Close">
                      <input
                        type="time"
                        step={1800}
                        value={hour.close_time}
                        disabled={!hour.is_open}
                        onChange={(event) =>
                          changeHour(weekday, {
                            close_time: event.target.value,
                          })
                        }
                        className={`${inputClass} disabled:opacity-40`}
                      />
                    </Field>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="rounded-[13px] bg-[#EDF3FA] p-4 text-[12px] leading-5 text-[#475467]">
            MECATREX reviews your registration, photo, business
            information, planned services and opening hours.
            Prices and publication become available after approval.
          </p>
        </section>
      )}

      <section className="mt-7 grid gap-4 border-t border-[#EAECF0] pt-7 sm:grid-cols-2">
        <TextField
          label="Password *"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        <TextField
          label="Confirm password *"
          name="confirm_password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
        <div className="text-[11px] text-[#667085] sm:col-span-2">
          Password: minimum 8 characters, one uppercase and one special character.
          {confirmPassword && (
            <span
              className={`ml-2 font-bold ${
                password === confirmPassword
                  ? "text-[#027A48]"
                  : "text-[#B42318]"
              }`}
            >
              {password === confirmPassword
                ? "✓ Passwords match"
                : "Passwords do not match"}
            </span>
          )}
        </div>
      </section>

      <label className="mt-6 flex items-start gap-3 text-[12px] leading-5 text-[#475467]">
        <input
          name="legal_consent"
          value="accepted"
          type="checkbox"
          required
          className="mt-1"
        />
        <span>
          I agree to the MECATREX{" "}
          <Link href="/terms" target="_blank" className="font-bold underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-bold underline">
            Privacy Policy
          </Link>.
        </span>
      </label>

      <button
        type="submit"
        disabled={!signupReady || pending}
        className="mt-7 w-full rounded-[14px] bg-[#4771A6] px-5 py-4 text-[15px] font-bold text-white hover:bg-[#315C91] disabled:cursor-not-allowed disabled:bg-[#B8C6D8]"
      >
        {pending
          ? "Submitting application..."
          : accountType === "provider"
            ? "Submit provider application"
            : "Create client account"}
      </button>
    </form>
  );
}
