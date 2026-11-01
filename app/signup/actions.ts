"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendAdminProviderApplicationEmail } from "@/lib/email/brevo";

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function signupError(message: string): never {
  redirect(`/signup?error=${encodeURIComponent(message)}`);
}

export async function signup(formData: FormData) {
  const accountType = value(formData, "account_type");
  const providerType = value(formData, "provider_type");
  const firstName = value(formData, "first_name");
  const lastName = value(formData, "last_name");
  const email = value(formData, "email").toLowerCase();
  const primaryPhone = value(formData, "primary_phone");
  const secondaryPhone = value(formData, "secondary_phone");
  const password = value(formData, "password");
  const confirmPassword = value(formData, "confirm_password");
  const businessName = value(formData, "business_name");
  const businessAddress = value(formData, "business_address");
  const businessCity = value(formData, "business_city");
  const businessProvince = value(formData, "business_province");
  const businessPostalCode = value(formData, "business_postal_code").toUpperCase();
  const businessPlaceId = value(formData, "business_place_id");

  if (accountType !== "client" && accountType !== "provider") {
    signupError("Please choose an account type.");
  }

  if (!firstName || !lastName) signupError("First name and last name are required.");
  if (!email) signupError("Email address is required.");

  if (!PHONE_REGEX.test(primaryPhone)) {
    signupError("Primary phone must use the format 514-555-1234.");
  }

  if (secondaryPhone && !PHONE_REGEX.test(secondaryPhone)) {
    signupError("Secondary phone must use the format 514-555-1234.");
  }

  if (!PASSWORD_REGEX.test(password)) {
    signupError("Password must contain at least 8 characters, 1 uppercase letter, and 1 special character.");
  }

  if (password !== confirmPassword) signupError("The passwords do not match.");

  if (accountType === "provider") {
    if (providerType !== "garage" && providerType !== "towing") {
      signupError("Choose Garage or Towing service.");
    }

    if (!businessName || !businessAddress || !businessPostalCode) {
      signupError("Complete the business information before submitting.");
    }

    if (businessCity !== "Montreal" || businessProvince !== "Quebec") {
      signupError("MECATREX provider registration is currently limited to Montreal, Quebec.");
    }

    if (process.env.GOOGLE_MAPS_API_KEY && !businessPlaceId) {
      signupError("Please choose your business address from the Google address suggestions.");
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm?next=/account`,
      data: {
        account_type: accountType,
        provider_type: accountType === "provider" ? providerType : null,
        first_name: firstName,
        last_name: lastName,
        primary_phone: primaryPhone,
        secondary_phone: secondaryPhone,
        business_name: accountType === "provider" ? businessName : null,
        business_address: accountType === "provider" ? businessAddress : null,
        business_city: accountType === "provider" ? "Montreal" : null,
        business_province: accountType === "provider" ? "Quebec" : null,
        business_postal_code: accountType === "provider" ? businessPostalCode : null,
        business_place_id: accountType === "provider" ? businessPlaceId || null : null,
      },
    },
  });

  if (error) signupError(error.message);

  if (accountType === "provider") {
    try {
      await sendAdminProviderApplicationEmail({
        firstName,
        lastName,
        email,
        primaryPhone,
        providerType: providerType as "garage" | "towing",
        businessName,
        businessAddress,
        city: "Montreal",
        province: "Quebec",
        postalCode: businessPostalCode,
      });
    } catch (emailError) {
      console.error("Admin notification email failed:", emailError);
    }
  }

  if (data.session) redirect("/account");
  redirect("/signup/check-email");
}
