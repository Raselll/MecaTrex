
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeNextPath(next: string) {
  if (
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\") &&
    !next.includes("\n") &&
    !next.includes("\r")
  ) {
    return next;
  }

  return "/account";
}

function loginError(
  message: string,
  email: string,
  next: string
): never {
  const params = new URLSearchParams();

  params.set("error", message);

  if (email) {
    params.set("email", email);
  }

  if (next) {
    params.set("next", safeNextPath(next));
  }

  redirect(`/login?${params.toString()}`);
}

export async function login(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = value(formData, "next");

  if (!email || !password) {
    loginError(
      "Enter your email and password.",
      email,
      next
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    loginError(
      error.message,
      email,
      next
    );
  }

  redirect(safeNextPath(next));
}
