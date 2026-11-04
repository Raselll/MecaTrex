"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/forgot-password?error=" + encodeURIComponent("Enter a valid email address."));
  }

  const supabase = await createClient();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: siteUrl + "/auth/confirm?next=/reset-password",
  });

  if (error) {
    const description = error.message.toLowerCase().includes("rate")
      ? "Too many requests. Please wait a little before trying again."
      : "We could not send a reset email right now. Please try again.";
    redirect("/forgot-password?error=" + encodeURIComponent(description));
  }

  // Never reveal whether this address belongs to a MECATREX account.
  redirect("/forgot-password?sent=1");
}
