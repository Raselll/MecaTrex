"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendAdminProviderApplicationEmail, sendProviderDecisionEmail } from "@/lib/email/brevo";

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
  if (recipient.currentStatus === status && !message) {
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

// Manual admin resend if the original application email failed.
export async function resendAdminApplicationEmail(formData: FormData) {
  const providerId = field(formData, "provider_id");
  if (!providerId) redirect(adminUrl("error", "Missing provider ID."));
  const supabase = await adminContext();
  const [{ data: provider }, { data: application }] = await Promise.all([
    supabase.from("service_providers")
      .select("id, owner_id, provider_type, business_name, address_line1, city, province, postal_code, public_phone, website")
      .eq("id", providerId).single(),
    supabase.from("provider_applications")
      .select("business_neq, application_services")
      .eq("provider_id", providerId).maybeSingle(),
  ]);
  if (!provider) redirect(adminUrl("error", "Provider not found."));
  const { data: owner } = await supabase.from("profiles")
    .select("first_name, last_name, email, primary_phone, secondary_phone")
    .eq("id", provider.owner_id).single();
  if (!owner || !application) redirect(adminUrl("error", "Application details missing. Apply migration 20261108."));
  let messageId: string | null = null;
  try {
    messageId = await sendAdminProviderApplicationEmail({
      firstName: owner.first_name,
      lastName: owner.last_name,
      email: owner.email,
      primaryPhone: owner.primary_phone,
      secondaryPhone: owner.secondary_phone || "",
      providerType: provider.provider_type as "garage" | "towing",
      businessName: provider.business_name,
      businessNEQ: application.business_neq || "Not provided",
      businessPhone: provider.public_phone || "",
      businessWebsite: provider.website || "",
      applicationServices: application.application_services || [],
      businessAddress: provider.address_line1,
      city: provider.city,
      province: provider.province,
      postalCode: provider.postal_code,
    });
  } catch (error) {
    console.error("Admin application email resend failed:", error);
    const reason = error instanceof Error ? error.message : "Unknown error";
    redirect(adminUrl("error", `Admin notification failed: ${reason}`));
  }
  redirect(adminUrl("success", `Brevo accepted the application alert. Message ID: ${messageId ?? "not returned"}. Check Brevo transactional logs for Delivered, Blocked or Bounced.`));
}

// Non-destructive removal: existing booking and review history is preserved.
export async function removeProvider(formData: FormData) {
  const providerId = field(formData, "provider_id");
  const reason = field(formData, "removal_reason");
  if (!providerId || reason.length < 10) redirect(adminUrl("error", "Write at least 10 characters explaining the removal."));
  const supabase = await adminContext();
  const recipient = await recipientForProvider(supabase, providerId);
  if (!recipient) redirect(adminUrl("error", "Provider or owner not found."));
  const { error } = await supabase.rpc("admin_remove_service_provider", {
    p_provider_id: providerId,
    p_reason: reason,
  });
  if (error) redirect(adminUrl("error", error.message));
  revalidatePath("/admin");
  revalidatePath("/account");
  revalidatePath("/");
  try {
    await sendProviderDecisionEmail({
      email: recipient.email,
      firstName: recipient.firstName,
      businessName: recipient.businessName,
      status: "rejected",
      message: "Your business was removed from MECATREX. " + reason,
    });
  } catch (emailError) {
    console.error("Business removed; email failed:", emailError);
    redirect(adminUrl("warning", "Business removed and unpublished. Notification failed: check Brevo and resend the decision email."));
  }
  redirect(adminUrl("success", "Business removed and unpublished; notification request accepted by Brevo."));
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
