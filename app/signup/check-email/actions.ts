
"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const EMAIL_COOKIE = "mecatrex_signup_email";
const NEXT_COOKIE = "mecatrex_signup_next";
const LAST_RESEND_COOKIE = "mecatrex_confirmation_last_resend";

const COOLDOWN_MS = 60_000;

export type ResendState = {
  status: "idle" | "success" | "error";
  message: string;
  retryAfterSeconds: number;
  requestId: number;
};

function result(
  status: "success" | "error",
  message: string,
  retryAfterSeconds = 0
): ResendState {
  return {
    status,
    message,
    retryAfterSeconds,
    requestId: Date.now(),
  };
}

function resendErrorMessage(
  message: string,
  status?: number
) {
  const normalized = message.toLowerCase();

  if (
    status === 429 ||
    normalized.includes("rate limit") ||
    normalized.includes("too many") ||
    normalized.includes("for security purposes")
  ) {
    return "Too many requests. Please wait a little longer before trying again.";
  }

  if (
    normalized.includes("email address not authorized") ||
    normalized.includes("not authorized to send") ||
    normalized.includes("smtp")
  ) {
    return "Email delivery is not configured for this address. Please ask the MECATREX administrator to configure Supabase Auth SMTP.";
  }

  return "We couldn't request another link right now. Please try again later or contact MECATREX support.";
}

export async function resendConfirmation(
  _previousState: ResendState,
  formData: FormData
): Promise<ResendState> {
  const email = String(
    formData.get("email") ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return result(
      "error",
      "Enter a valid email address."
    );
  }

  const cookieStore = await cookies();

  const now = Date.now();

  const lastRequest = Number(
    cookieStore.get(LAST_RESEND_COOKIE)?.value ?? 0
  );

  const elapsed = now - lastRequest;

  if (
    lastRequest > 0 &&
    elapsed >= 0 &&
    elapsed < COOLDOWN_MS
  ) {
    const seconds = Math.ceil(
      (COOLDOWN_MS - elapsed) / 1000
    );

    return result(
      "error",
      "Please wait before requesting another link.",
      seconds
    );
  }

  const nextValue =
    cookieStore.get(NEXT_COOKIE)?.value ?? "/account";

  const safeNext =
    nextValue.startsWith("/book/") &&
    !nextValue.startsWith("//") &&
    !nextValue.includes("\\")
      ? nextValue
      : "/account";

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const redirectTo =
    `${siteUrl}/auth/confirm?next=` +
    encodeURIComponent(safeNext);

  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      return result(
        "error",
        resendErrorMessage(
          error.message,
          error.status
        )
      );
    }
  } catch (error) {
    console.error(
      "MECATREX confirmation resend failed:",
      error
    );

    return result(
      "error",
      "Unable to request a new link right now. Please contact MECATREX support if this continues."
    );
  }

  const secure =
    process.env.NODE_ENV === "production";

  cookieStore.set(EMAIL_COOKIE, email, {
    path: "/signup",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 60 * 30,
  });

  cookieStore.set(LAST_RESEND_COOKIE, String(now), {
    path: "/signup",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 60,
  });

  return result(
    "success",
    "Another confirmation email has been requested. Check your inbox and spam folder.",
    60
  );
}
