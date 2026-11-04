"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,}$/;

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");
  if (!PASSWORD_REGEX.test(password)) {
    redirect("/reset-password?error=" + encodeURIComponent("Use at least 8 characters, 1 uppercase letter and 1 special character."));
  }
  if (password !== confirmation) {
    redirect("/reset-password?error=" + encodeURIComponent("Passwords do not match."));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=" + encodeURIComponent("Your reset link has expired. Request a new one."));

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect("/reset-password?error=" + encodeURIComponent("Unable to update your password. Request a new link if this one has expired."));
  }

  await supabase.auth.signOut();
  redirect("/login?notice=" + encodeURIComponent("Your password has been updated. Log in with your new password."));
}
