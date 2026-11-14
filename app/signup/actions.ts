
"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendAdminProviderApplicationEmail } from "@/lib/email/brevo";
import { MECATREX_LEGAL_VERSION } from "@/lib/legal";
import { normalizeBusinessWebsite } from "@/lib/service-listing";
import { parseApplicationServices } from "@/lib/provider-application";
import {
  validateBusinessHours,
  type BusinessHoursDraft,
} from "@/lib/business-hours";

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,}$/;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SignupActionState = {
  error: string | null;
};

function value(data: FormData, name: string) {
  return String(data.get(name) ?? "").trim();
}

function rawValue(data: FormData, name: string) {
  return String(data.get(name) ?? "");
}

function signupError(message: string): SignupActionState {
  return { error: message };
}

function friendlySignupError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("user already registered")) {
    return "An account already exists with this email. Please log in.";
  }

  if (
    normalized.includes("for security purposes") &&
    normalized.includes("only request this after")
  ) {
    return "Please wait about one minute before trying again.";
  }

  return message;
}

function optionalCoordinate(data: FormData, key: string) {
  const raw = value(data, key);
  if (!raw) return null;
  const result = Number(raw);
  return Number.isFinite(result) ? result : null;
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing from .env.local."
    );
  }

  return createSupabaseAdmin(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function validatePhoto(file: File | null) {
  if (!file || file.size === 0) {
    throw new Error("A business photo is required.");
  }

  if (
    !PHOTO_TYPES.some((type) => type === file.type) ||
    file.size > MAX_PHOTO_SIZE
  ) {
    throw new Error(
      "Choose a JPG, PNG or WebP image, maximum 5 MB."
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  const png =
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10;

  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

  const correctType =
    (file.type === "image/jpeg" && jpeg) ||
    (file.type === "image/png" && png) ||
    (file.type === "image/webp" && webp);

  if (!correctType) {
    throw new Error("The selected file is not a valid image.");
  }

  return bytes;
}

export async function signup(
  _previousState: SignupActionState,
  formData: FormData
): Promise<SignupActionState> {
  const intendedNext = value(formData, "next");

  const safeNext =
    intendedNext.startsWith("/book/") &&
    !intendedNext.startsWith("//") &&
    !intendedNext.includes("\\")
      ? intendedNext
      : "/account";

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
  const businessPostalCode = value(
    formData,
    "business_postal_code"
  ).toUpperCase();

  const businessNEQ = value(formData, "business_neq")
    .replace(/\s/g, "");

  const businessPhone = value(formData, "business_phone");
  const businessWebsite = value(formData, "business_website");
  const applicationDescription = value(
    formData,
    "application_description"
  );

  const website = normalizeBusinessWebsite(businessWebsite);

  const applicationServices =
    accountType === "provider" &&
    (providerType === "garage" || providerType === "towing")
      ? parseApplicationServices(
          value(formData, "application_services"),
          providerType
        )
      : null;

  const businessPlaceId = value(formData, "business_place_id");

  const businessLatitude = optionalCoordinate(
    formData,
    "business_latitude"
  );

  const businessLongitude = optionalCoordinate(
    formData,
    "business_longitude"
  );

  let businessHours: BusinessHoursDraft[] = [];
  let imageBytes: Uint8Array<ArrayBuffer> | null = null;
  let photoType = "";

  if (accountType !== "client" && accountType !== "provider") {
    return signupError("Please choose an account type.");
  }

  if (!firstName || !lastName) {
    return signupError("First name and last name are required.");
  }

  if (!email) {
    return signupError("An email address is required.");
  }

  if (!PHONE_REGEX.test(primaryPhone)) {
    return signupError(
      "Primary phone must use format 514-555-1234."
    );
  }

  if (secondaryPhone && !PHONE_REGEX.test(secondaryPhone)) {
    return signupError("Invalid secondary phone number.");
  }

  if (!PASSWORD_REGEX.test(password)) {
    return signupError(
      "Password must have 8 characters, one uppercase and one special character."
    );
  }

  if (password !== confirmPassword) {
    return signupError("Passwords do not match.");
  }

  if (legalConsent !== "accepted") {
    return signupError(
      "Accept the Terms of Service and Privacy Policy."
    );
  }

  if (accountType === "provider") {
    if (providerType !== "garage" && providerType !== "towing") {
      return signupError("Choose Garage or Towing service.");
    }

    if (!businessName || !businessAddress || !businessPostalCode) {
      return signupError("Complete all business information.");
    }

    if (businessCity !== "Montreal" || businessProvince !== "Quebec") {
      return signupError(
        "MECATREX currently supports Montreal, Quebec."
      );
    }

    if (!/^\d{10}$/.test(businessNEQ)) {
      return signupError("Enter a valid 10-digit NEQ.");
    }

    if (!PHONE_REGEX.test(businessPhone)) {
      return signupError("Enter a valid business phone.");
    }

    if (businessWebsite && !website) {
      return signupError("Enter a valid business website URL.");
    }

    if (!applicationServices?.length) {
      return signupError("Select at least one service.");
    }

    if (process.env.GOOGLE_MAPS_API_KEY && !businessPlaceId) {
      return signupError(
        "Select your address from the Google suggestions."
      );
    }

    try {
      const parsedHours: unknown = JSON.parse(
        value(formData, "business_hours")
      );

      const validated = validateBusinessHours(parsedHours);

      if (!validated) {
        return signupError(
          "Check your business opening and closing hours."
        );
      }

      businessHours = validated;
    } catch {
      return signupError("Invalid business hours.");
    }

    const photo = formData.get("business_photo");

    try {
      if (!(photo instanceof File)) {
        return signupError("Upload your business photo.");
      }

      imageBytes = await validatePhoto(photo);
      photoType = photo.type;

      // Check configuration before creating the account.
      getAdminClient();
    } catch (error) {
      return signupError(
        error instanceof Error ? error.message : "Invalid photo."
      );
    }
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${
        process.env.NEXT_PUBLIC_SITE_URL ??
        "http://localhost:3000"
      }/auth/confirm?next=${encodeURIComponent(safeNext)}`,

      data: {
        account_type: accountType,
        provider_type:
          accountType === "provider" ? providerType : null,

        first_name: firstName,
        last_name: lastName,
        primary_phone: primaryPhone,
        secondary_phone: secondaryPhone,

        terms_accepted: true,
        privacy_accepted: true,
        legal_version: MECATREX_LEGAL_VERSION,

        business_name:
          accountType === "provider" ? businessName : null,

        business_neq:
          accountType === "provider" ? businessNEQ : null,

        business_phone:
          accountType === "provider" ? businessPhone : null,

        business_website:
          accountType === "provider" ? website : null,

        application_description:
          accountType === "provider"
            ? applicationDescription
            : null,

        application_services:
          accountType === "provider"
            ? applicationServices
            : null,

        business_hours:
          accountType === "provider" ? businessHours : null,

        business_address:
          accountType === "provider" ? businessAddress : null,

        business_city:
          accountType === "provider" ? businessCity : null,

        business_province:
          accountType === "provider" ? businessProvince : null,

        business_postal_code:
          accountType === "provider"
            ? businessPostalCode
            : null,

        business_place_id:
          accountType === "provider"
            ? businessPlaceId || null
            : null,

        business_latitude:
          accountType === "provider"
            ? businessLatitude
            : null,

        business_longitude:
          accountType === "provider"
            ? businessLongitude
            : null,
      },
    },
  });

  if (error) {
    return signupError(friendlySignupError(error.message));
  }

  if (!data.user) {
    return signupError("Account creation failed.");
  }

  // Supabase may return an obfuscated user for duplicate emails.
  if (
    accountType === "provider" &&
    data.user.identities?.length === 0
  ) {
    return signupError(
      "If this email already has an account, please log in."
    );
  }

  if (accountType === "provider") {
    const admin = getAdminClient();
    const userId = data.user.id;

    const extension =
      photoType === "image/png"
        ? "png"
        : photoType === "image/webp"
          ? "webp"
          : "jpg";

    const photoPath = `${userId}/application-${crypto.randomUUID()}.${extension}`;

    try {
      if (!imageBytes) {
        throw new Error("Business photo is missing.");
      }

      const { error: uploadError } = await admin.storage
        .from("garage-images")
        .upload(photoPath, imageBytes, {
          contentType: photoType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: savedProvider, error: updateError } = await admin
        .from("service_providers")
        .update({ image_path: photoPath })
        .eq("owner_id", userId)
        .select("id")
        .single();

      if (updateError || !savedProvider) {
        throw new Error(
          updateError?.message ??
          "Business profile was not created."
        );
      }
    } catch (photoError) {
      // Remove only the newly created, unconfirmed account
      // and its uploaded photo when initial submission fails.
      await admin.storage
        .from("garage-images")
        .remove([photoPath]);

      const { error: rollbackError } =
        await admin.auth.admin.deleteUser(userId);

      if (rollbackError) {
        console.error("Signup rollback failed:", rollbackError);
      }

      console.error("Provider photo setup failed:", photoError);

      return signupError(
        rollbackError
          ? "Photo setup failed. Contact support before retrying; the account may already exist."
          : "Photo setup failed. Please retry your application."
      );
    }
  }

  let adminEmailAccepted = false;

  if (accountType === "provider") {
    try {
      await sendAdminProviderApplicationEmail({
        firstName,
        lastName,
        email,
        primaryPhone,
        secondaryPhone,
        providerType: providerType as "garage" | "towing",
        businessName,
        businessNEQ,
        businessPhone,
        businessWebsite: website ?? "",
        applicationServices: applicationServices ?? [],
        businessAddress,
        city: businessCity,
        province: businessProvince,
        postalCode: businessPostalCode,
      });

      adminEmailAccepted = true;
    } catch (emailError) {
      console.error(
        "MECATREX admin application notification failed:",
        emailError
      );
    }
  }

  const cookieStore = await cookies();

  if (adminEmailAccepted) {
    cookieStore.set("mecatrex_admin_alert", data.user.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  if (data.session) {
    redirect(safeNext);
  }

  const cookieOptions = {
    path: "/signup",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30,
  };

  cookieStore.set("mecatrex_signup_email", email, cookieOptions);
  cookieStore.set("mecatrex_signup_next", safeNext, cookieOptions);

  cookieStore.set(
    "mecatrex_confirmation_last_resend",
    "",
    { ...cookieOptions, maxAge: 0 }
  );

  redirect("/signup/check-email");
}
