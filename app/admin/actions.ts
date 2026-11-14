
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  sendAdminProviderApplicationEmail,
  sendProviderDecisionEmail,
} from "@/lib/email/brevo";

type Decision = "approved" | "needs_information" | "rejected";

const ALLOWED_STATUSES: Decision[] = [
  "approved",
  "needs_information",
  "rejected",
];

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function adminUrl(
  kind: "error" | "success" | "warning",
  message: string,
  view = "all"
) {
  return `/admin?view=${encodeURIComponent(view)}&${kind}=${encodeURIComponent(message)}#applications`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function adminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .single();

  if (profile?.account_type !== "admin") {
    redirect("/account");
  }

  return supabase;
}

async function recipientForProvider(
  supabase: Awaited<ReturnType<typeof createClient>>,
  providerId: string
) {
  const { data: provider } = await supabase
    .from("service_providers")
    .select("id, owner_id, business_name, status, is_removed")
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
    isRemoved: Boolean(provider.is_removed),
  };
}

export async function setProviderStatus(formData: FormData) {
  const providerId = field(formData, "provider_id");
  const status = field(formData, "status") as Decision;
  const message = field(formData, "message");

  if (!providerId || !ALLOWED_STATUSES.includes(status)) {
    redirect(adminUrl("error", "Invalid provider decision."));
  }

  if (
    (status === "rejected" || status === "needs_information") &&
    !message
  ) {
    redirect(
      adminUrl(
        "error",
        "Write a reason or explain what information is missing."
      )
    );
  }

  const supabase = await adminContext();
  const recipient = await recipientForProvider(supabase, providerId);

  if (!recipient) {
    redirect(adminUrl("error", "Provider or owner not found."));
  }

  if (recipient.isRemoved) {
    redirect(adminUrl("error", "This provider was removed."));
  }

  if (
    recipient.currentStatus === "approved" &&
    status !== "approved"
  ) {
    redirect(
      adminUrl(
        "error",
        "This provider is already approved. Use Communicate with provider instead."
      )
    );
  }

  if (recipient.currentStatus === status) {
    redirect(
      adminUrl(
        "warning",
        `This application is already ${status.replaceAll("_", " ")}.`
      )
    );
  }

  const { error: decisionError } = await supabase.rpc(
    "admin_set_provider_status",
    {
      p_provider_id: providerId,
      p_status: status,
      p_message: message || null,
    }
  );

  if (decisionError) {
    redirect(adminUrl("error", decisionError.message));
  }

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
    console.error("Decision email failed:", error);
    redirect(
      adminUrl(
        "warning",
        `${recipient.businessName} was updated, but the email could not be sent.`
      )
    );
  }

  redirect(
    adminUrl(
      "success",
      `${recipient.businessName} updated to ${status.replaceAll("_", " ")}. Email request accepted by Brevo.`
    )
  );
}

export async function communicateWithProvider(formData: FormData) {
  const providerId = field(formData, "provider_id");
  const subject = field(formData, "subject").slice(0, 150);
  const message = field(formData, "message").slice(0, 3000);

  if (!providerId || subject.length < 3 || message.length < 3) {
    redirect(
      adminUrl(
        "error",
        "Provide a subject and a message before contacting the provider."
      )
    );
  }

  const supabase = await adminContext();
  const recipient = await recipientForProvider(supabase, providerId);

  if (!recipient || recipient.isRemoved) {
    redirect(adminUrl("error", "Provider not found."));
  }

  if (recipient.currentStatus !== "approved") {
    redirect(
      adminUrl(
        "error",
        "Use Request more info while the application is under review."
      )
    );
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (
    !apiKey?.startsWith("xkeysib-") ||
    !senderEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)
  ) {
    redirect(
      adminUrl(
        "error",
        "Brevo email configuration is incomplete."
      )
    );
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  let response: Response;

  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: "MECATREX",
          email: senderEmail,
        },
        to: [
          {
            email: recipient.email,
            name: recipient.firstName,
          },
        ],
        ...(process.env.MECATREX_ADMIN_EMAIL
          ? {
              replyTo: {
                email: process.env.MECATREX_ADMIN_EMAIL,
              },
            }
          : {}),
        subject: `MECATREX — ${subject}`,
        htmlContent: `
          <div style="font-family:Arial,sans-serif;color:#101828;line-height:1.7;max-width:640px;margin:auto">
            <h2>Message from MECATREX</h2>
            <p>Hello ${escapeHtml(recipient.firstName)},</p>
            <p>We are contacting you regarding <strong>${escapeHtml(recipient.businessName)}</strong>.</p>
            <h3>${escapeHtml(subject)}</h3>
            <div style="white-space:pre-wrap;background:#f4f7fb;padding:18px;border-radius:12px;border:1px solid #d7e2ef">${escapeHtml(message)}</div>
            <p>Your business approval remains unchanged.</p>
            <p><a href="${escapeHtml(siteUrl)}/account">Open your MECATREX account</a></p>
            <p>— MECATREX Administration</p>
          </div>
        `,
      }),
    });
  } catch (error) {
    console.error("Communication email failed:", error);
    redirect(
      adminUrl("error", "Could not contact Brevo. Try again.")
    );
  }

  if (!response.ok) {
    console.error(
      "Brevo communication error:",
      response.status,
      await response.text()
    );
    redirect(
      adminUrl(
        "error",
        "Brevo rejected the communication email."
      )
    );
  }

  // Save the most recent communication in the existing notes table.
  const { error: noteError } = await supabase
    .from("provider_admin_notes")
    .upsert(
      {
        provider_id: providerId,
        message: `${subject}\n\n${message}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider_id" }
    );

  if (noteError) {
    console.error(
      "Email accepted but saving the admin note failed:",
      noteError
    );
    redirect(
      adminUrl(
        "warning",
        "Brevo accepted the email, but the note could not be saved."
      )
    );
  }

  revalidatePath("/admin");
  revalidatePath("/account");

  redirect(
    adminUrl(
      "success",
      `Communication sent to ${recipient.email}. Approval status unchanged.`
    )
  );
}

export async function resendAdminApplicationEmail(
  formData: FormData
) {
  const providerId = field(formData, "provider_id");

  if (!providerId) {
    redirect(adminUrl("error", "Missing provider ID."));
  }

  const supabase = await adminContext();

  const [
    { data: provider },
    { data: application },
  ] = await Promise.all([
    supabase
      .from("service_providers")
      .select(
        "id, owner_id, provider_type, business_name, address_line1, city, province, postal_code, public_phone, website"
      )
      .eq("id", providerId)
      .single(),
    supabase
      .from("provider_applications")
      .select("business_neq, application_services")
      .eq("provider_id", providerId)
      .maybeSingle(),
  ]);

  if (!provider || !application) {
    redirect(adminUrl("error", "Application details missing."));
  }

  const { data: owner } = await supabase
    .from("profiles")
    .select(
      "first_name, last_name, email, primary_phone, secondary_phone"
    )
    .eq("id", provider.owner_id)
    .single();

  if (!owner) {
    redirect(adminUrl("error", "Owner not found."));
  }

  try {
    await sendAdminProviderApplicationEmail({
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
    console.error("Admin application email failed:", error);
    redirect(adminUrl("error", "Failed to resend application."));
  }

  redirect(
    adminUrl("success", "Application email accepted by Brevo.")
  );
}

export async function removeProvider(formData: FormData) {
  const providerId = field(formData, "provider_id");
  const reason = field(formData, "removal_reason");

  if (!providerId || reason.length < 10) {
    redirect(
      adminUrl("error", "Write at least 10 characters explaining the removal.")
    );
  }

  const supabase = await adminContext();
  const recipient = await recipientForProvider(supabase, providerId);

  if (!recipient) {
    redirect(adminUrl("error", "Provider not found."));
  }

  const { error } = await supabase.rpc(
    "admin_remove_service_provider",
    {
      p_provider_id: providerId,
      p_reason: reason,
    }
  );

  if (error) {
    redirect(adminUrl("error", error.message));
  }

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
    console.error("Removal notification failed:", emailError);
    redirect(
      adminUrl(
        "warning",
        "Business removed and unpublished, but email failed."
      )
    );
  }

  redirect(
    adminUrl(
      "success",
      "Business removed and unpublished. Notification accepted."
    )
  );
}

export async function resendProviderDecisionEmail(
  formData: FormData
) {
  const providerId = field(formData, "provider_id");

  if (!providerId) {
    redirect(adminUrl("error", "Missing provider ID."));
  }

  const supabase = await adminContext();
  const recipient = await recipientForProvider(supabase, providerId);

  if (!recipient) {
    redirect(adminUrl("error", "Provider not found."));
  }

  if (recipient.currentStatus === "pending") {
    redirect(
      adminUrl(
        "error",
        "Review this application before resending a decision."
      )
    );
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
    console.error("Decision resend failed:", error);
    redirect(
      adminUrl("error", "Failed to resend the provider email.")
    );
  }

  redirect(
    adminUrl(
      "success",
      `Decision email accepted by Brevo for ${recipient.email}.`
    )
  );
}
