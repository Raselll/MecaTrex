"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendAdminProviderApplicationEmail } from "@/lib/email/brevo";
import { MECATREX_LEGAL_VERSION } from "@/lib/legal";
import { validateBusinessHours, type BusinessHoursDraft } from "@/lib/business-hours";

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,}$/;

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function rawValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export type SignupActionState = { error: string | null };

function signupError(message: string): SignupActionState {
  return { error: message };
}

function friendlySignupError(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("for security purposes") &&
    normalized.includes("only request this after")
  ) {
    return "Please wait about one minute before requesting another verification email, then submit again.";
  }

  if (normalized.includes("user already registered")) {
    return "An account already exists with this email. Please log in instead.";
  }

  return message;
}

function optionalCoordinate(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function signup(_previousState: SignupActionState, formData: FormData): Promise<SignupActionState> {
  const intendedNext = value(formData, "next");
  const safeNext = intendedNext.startsWith("/book/") && !intendedNext.includes("\\") && !intendedNext.startsWith("//") ? intendedNext : "/account";
  const accountType = value(formData, "account_type");
  const providerType = value(formData, "provider_type");
  const firstName = value(formData, "first_name");
  const lastName = value(formData, "last_name");
  const email = value(formData, "email").toLowerCase();
  const primaryPhone = value(formData, "primary_phone");
  const secondaryPhone = value(formData, "secondary_phone");
  const password = rawValue(formData, "password");
  const confirmPassword = rawValue(formData, "confirm_password");
  const legalConsent = value(formData, "legal_consent");
  const businessName = value(formData, "business_name");
  const businessAddress = value(formData, "business_address");
  const businessCity = value(formData, "business_city");
  const businessProvince = value(formData, "business_province");
  const businessPostalCode = value(formData, "business_postal_code").toUpperCase();
  const businessPlaceId = value(formData, "business_place_id");
  const businessLatitude = optionalCoordinate(formData, "business_latitude");
  const businessLongitude = optionalCoordinate(formData, "business_longitude");
  const hoursJson = value(formData, "business_hours");
  let businessHours: BusinessHoursDraft[] = [];
  if (accountType === "provider") {
    let parsedHours: unknown;
    try {
      parsedHours = JSON.parse(hoursJson);
    } catch {
      return signupError("Please check your opening hours and try again.");
    }

    const validHours = validateBusinessHours(parsedHours);
    if (!validHours) {
      return signupError("Please review your business hours. Choose a valid opening and closing time for every open day.");
    }
    businessHours = validHours;
  }

  if (accountType !== "client" && accountType !== "provider") {
    return signupError("Please choose an account type.");
  }

  if (!firstName || !lastName) return signupError("First name and last name are required.");
  if (!email) return signupError("Email address is required.");

  if (!PHONE_REGEX.test(primaryPhone)) {
    return signupError("Primary phone must use the format 514-555-1234.");
  }

  if (secondaryPhone && !PHONE_REGEX.test(secondaryPhone)) {
    return signupError("Secondary phone must use the format 514-555-1234.");
  }

  if (!PASSWORD_REGEX.test(password)) {
    return signupError("Password must contain at least 8 characters, 1 uppercase letter, and 1 special character.");
  }

  if (password !== confirmPassword) return signupError("The passwords do not match.");

  if (legalConsent !== "accepted") {
    return signupError("You must agree to the MECATREX Terms of Service and Privacy Policy to create an account.");
  }

  if (accountType === "provider") {
    if (providerType !== "garage" && providerType !== "towing") {
      return signupError("Choose Garage or Towing service.");
    }

    if (!businessName || !businessAddress || !businessPostalCode) {
      return signupError("Complete the business information before submitting.");
    }

    if (businessCity !== "Montreal" || businessProvince !== "Quebec") {
      return signupError("MECATREX provider registration is currently limited to Montreal, Quebec.");
    }

    if (process.env.GOOGLE_MAPS_API_KEY && !businessPlaceId) {
      return signupError("Please choose your business address from the Google address suggestions.");
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm?next=${encodeURIComponent(safeNext)}`,
      data: {
        account_type: accountType,
        provider_type: accountType === "provider" ? providerType : null,
        first_name: firstName,
        last_name: lastName,
        primary_phone: primaryPhone,
        secondary_phone: secondaryPhone,
        terms_accepted: true,
        privacy_accepted: true,
        legal_version: MECATREX_LEGAL_VERSION,
        business_name: accountType === "provider" ? businessName : null,
        business_hours: accountType === "provider" ? businessHours : null,
        business_address: accountType === "provider" ? businessAddress : null,
        business_city: accountType === "provider" ? "Montreal" : null,
        business_province: accountType === "provider" ? "Quebec" : null,
        business_postal_code: accountType === "provider" ? businessPostalCode : null,
        business_place_id: accountType === "provider" ? businessPlaceId || null : null,
        business_latitude: accountType === "provider" ? businessLatitude : null,
        business_longitude: accountType === "provider" ? businessLongitude : null,
      },
    },
  });

  if (error) return signupError(friendlySignupError(error.message));

  // Supabase may return an obfuscated user for an email that is already registered.
  // Notify administrators only for a newly created, genuine provider identity.
  if (accountType === "provider" && data.user && data.user.identities?.length !== 0) {
    try {
      await sendAdminProviderApplicationEmail({
        firstName,
        lastName,
        email,
        primaryPhone,
        secondaryPhone,
        providerType: providerType as "garage" | "towing",
        businessName,
        businessAddress,
        city: "Montreal",
        province: "Quebec",
        postalCode: businessPostalCode,
      });
    } catch (emailError) {
      console.error("MECATREX new provider alert was not delivered:", emailError);
    }
  }

  if (data.session) redirect(safeNext);
  redirect("/signup/check-email");
}
