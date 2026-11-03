"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendProviderDecisionEmail } from "@/lib/email/brevo";

const ALLOWED_STATUSES = new Set(["approved", "needs_information", "rejected"]);

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function setProviderStatus(formData: FormData) {
  const providerId = value(formData, "provider_id");
  const status = value(formData, "status") as "approved" | "needs_information" | "rejected";
  const message = value(formData, "message");

  if (!providerId || !ALLOWED_STATUSES.has(status)) {
    redirect("/admin?error=Invalid%20provider%20decision.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .single();

  if (adminProfile?.account_type !== "admin") redirect("/account");

  const { data: provider, error: providerError } = await supabase
    .from("service_providers")
    .select("id, owner_id, business_name")
    .eq("id", providerId)
    .single();

  if (providerError || !provider) {
    redirect("/admin?error=Provider%20not%20found.");
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("id", provider.owner_id)
    .single();

  const { error: decisionError } = await supabase.rpc("admin_set_provider_status", {
    p_provider_id: providerId,
    p_status: status,
    p_message: message || null,
  });

  if (decisionError) {
    redirect(`/admin?error=${encodeURIComponent(decisionError.message)}`);
  }

  if (ownerProfile?.email) {
    try {
      await sendProviderDecisionEmail({
        email: ownerProfile.email,
        firstName: ownerProfile.first_name || "there",
        businessName: provider.business_name,
        status,
        message: message || undefined,
      });
    } catch (emailError) {
      console.error("Provider decision email failed:", emailError);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/account");
  revalidatePath("/");
  redirect(`/admin?success=${encodeURIComponent(`${provider.business_name} updated to ${status.replace("_", " ")}.`)}`);
}
