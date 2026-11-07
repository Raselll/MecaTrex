import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAdminProviderApplicationEmail } from "@/lib/email/brevo";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") &&
    !value.includes("\\") ? value : "/account";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await createClient();
  let confirmationError: Error | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    confirmationError = result.error;
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    confirmationError = result.error;
  } else {
    confirmationError = new Error("Missing confirmation token.");
  }

  if (confirmationError) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", "This confirmation link is invalid or has expired. Request another link or sign in.");
    return NextResponse.redirect(login);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  // The signed-in database profile, never user-editable metadata, determines permissions.
  const { data: profile } = await supabase.from("profiles")
    .select("account_type").eq("id", user.id).maybeSingle();
  if (profile?.account_type !== "provider") {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // Older users may lack the provider row because migrations were installed after signup.
  // A SQL migration also backfills existing accounts; this RPC repairs new gaps safely.
  const recovered = await supabase.rpc("ensure_my_provider_record");
  if (recovered.error) {
    console.error("MECATREX provider recovery unavailable. Run migration 20261110:", recovered.error.message);
  }

  const { data: provider, error: providerError } = await supabase.from("service_providers")
    .select("id,status").eq("owner_id", user.id).maybeSingle();

  if (providerError) {
    console.error("MECATREX verified provider record lookup failed:", providerError.message);
  }

  // The signup action attempted the initial notification. Retry only if Brevo did
  // not accept it in this browser. The admin inbox is not the source of truth;
  // provider status remains "pending" in Postgres until a secured admin decision.
  const cookieStore = await cookies();
  if (provider && provider.status === "pending" &&
      cookieStore.get("mecatrex_admin_alert")?.value !== user.id) {
    const meta = user.user_metadata ?? {};
    const services = Array.isArray(meta.application_services)
      ? meta.application_services.filter((service: unknown): service is string =>
          typeof service === "string" && service.length <= 100)
      : [];
    try {
      const messageId = await sendAdminProviderApplicationEmail({
        firstName: String(meta.first_name ?? ""),
        lastName: String(meta.last_name ?? ""),
        email: user.email ?? "",
        primaryPhone: String(meta.primary_phone ?? ""),
        secondaryPhone: String(meta.secondary_phone ?? ""),
        providerType: meta.provider_type === "towing" ? "towing" : "garage",
        businessName: String(meta.business_name ?? ""),
        businessNEQ: String(meta.business_neq ?? ""),
        businessPhone: String(meta.business_phone ?? ""),
        businessWebsite: String(meta.business_website ?? ""),
        applicationServices: services,
        businessAddress: String(meta.business_address ?? ""),
        city: String(meta.business_city ?? "Montreal"),
        province: String(meta.business_province ?? "Quebec"),
        postalCode: String(meta.business_postal_code ?? ""),
      });
      console.info("MECATREX verified application alert accepted by Brevo:", messageId ?? "no message ID");
      cookieStore.set("mecatrex_admin_alert", user.id, {
        path: "/", httpOnly: true, sameSite: "lax",
        secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7,
      });
    } catch (error) {
      console.error("MECATREX verified provider admin email failed:", error);
    }
  }

  return NextResponse.redirect(new URL("/account?verified=1", url.origin));
}
