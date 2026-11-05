"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendProviderDecisionEmail } from "@/lib/email/brevo";

type Decision = "approved" | "needs_information" | "rejected";
const ALLOWED_STATUSES: Decision[] = ["approved", "needs_information", "rejected"];

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function adminUrl(kind: "error" | "success" | "warning", message: string, view = "all") {
  return `/admin?view=${encodeURIComponent(view)}&${kind}=${encodeURIComponent(message)}#applications`;
}

async function adminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .single();

  if (profile?.account_type !== "admin") redirect("/account");
  return supabase;
}

async function recipientForProvider(
  supabase: Awaited<ReturnType<typeof createClient>>,
  providerId: string
) {
  const { data: provider } = await supabase
    .from("service_providers")
    .select("id, owner_id, business_name, status")
    .eq("id", providerId)
    .single();

  if (!provider) return null;
  const { data: owner } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("id", provider.owner_id)
    .single();

  if (!owner?.email) return null;
  return {
    email: owner.email as string,
    firstName: (owner.first_name as string) || "there",
    businessName: provider.business_name as string,
    currentStatus: provider.status as "pending" | Decision,
  };
}

export async function setProviderStatus(formData: FormData) {
  const providerId = field(formData, "provider_id");
  const status = field(formData, "status") as Decision;
  const message = field(formData, "message");
  if (!providerId || !ALLOWED_STATUSES.includes(status)) {
    redirect(adminUrl("error", "Invalid provider decision."));
  }
  if ((status === "rejected" || status === "needs_information") && !message) {
    redirect(adminUrl("error", "Please write a reason or the missing information before sending this decision."));
  }

  const supabase = await adminContext();
  const recipient = await recipientForProvider(supabase, providerId);
  if (!recipient) redirect(adminUrl("error", "Provider or owner email not found."));
  if (recipient.currentStatus === status) {
    redirect(adminUrl("warning", `This application is already ${status.replaceAll("_", " ")}. Use Resend notification if needed.`));
  }

  const { error: decisionError } = await supabase.rpc("admin_set_provider_status", {
    p_provider_id: providerId,
    p_status: status,
    p_message: message || null,
  });
  if (decisionError) redirect(adminUrl("error", decisionError.message));

  revalidatePath("/admin");
  revalidatePath("/account");
  revalidatePath("/");

  try {
    await sendProviderDecisionEmail({
      email: recipient.email,
      firstName: recipient.firstName,
      businessName: recipient.businessName,
      status,
      message: message || undefined,
    });
  } catch (error) {
    console.error("Provider decision saved but email failed:", error);
    redirect(adminUrl("warning",
      `${recipient.businessName} was updated to ${status.replaceAll("_", " ")}, but the notification email was NOT delivered. Configure Brevo, then click Resend notification.`
    ));
  }

  redirect(adminUrl("success", `${recipient.businessName} updated to ${status.replaceAll("_", " ")}. Brevo accepted the notification email.`));
}

export async function resendProviderDecisionEmail(formData: FormData) {
  const providerId = field(formData, "provider_id");
  if (!providerId) redirect(adminUrl("error", "Missing provider ID."));

  const supabase = await adminContext();
  const recipient = await recipientForProvider(supabase, providerId);
  if (!recipient) redirect(adminUrl("error", "Provider or owner email not found."));
  if (recipient.currentStatus === "pending") {
    redirect(adminUrl("error", "Review the application before sending a decision email."));
  }

  const { data: note } = await supabase
    .from("provider_admin_notes")
    .select("message")
    .eq("provider_id", providerId)
    .maybeSingle();

  try {
    await sendProviderDecisionEmail({
      email: recipient.email,
      firstName: recipient.firstName,
      businessName: recipient.businessName,
      status: recipient.currentStatus,
      message: note?.message ?? undefined,
    });
  } catch (error) {
    console.error("Resend of provider decision failed:", error);
    redirect(adminUrl("error", "Email delivery failed. Verify BREVO_API_KEY, BREVO_SENDER_EMAIL and your Brevo transactional logs."));
  }

  redirect(adminUrl("success", `Notification resent to ${recipient.email}. Brevo accepted the request.`));
}
