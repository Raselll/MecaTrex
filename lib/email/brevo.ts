type ProviderApplicationEmail = {
  firstName: string;
  lastName: string;
  email: string;
  primaryPhone: string;
  secondaryPhone?: string;
  providerType: "garage" | "towing";
  businessName: string;
  businessAddress: string;
  city: string;
  province: string;
  postalCode: string;
};

type ProviderDecisionEmail = {
  email: string;
  firstName: string;
  businessName: string;
  status: "approved" | "needs_information" | "rejected";
  message?: string;
};

function appUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}


function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendBrevoEmail({
  toEmail,
  toName,
  subject,
  html,
}: {
  toEmail: string;
  toName: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    throw new Error("Missing BREVO_API_KEY or BREVO_SENDER_EMAIL in the MECATREX server environment.");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "MECATREX", email: senderEmail },
      to: [{ email: toEmail, name: toName }],
      ...(process.env.MECATREX_ADMIN_EMAIL ? { replyTo: { email: process.env.MECATREX_ADMIN_EMAIL } } : {}),
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    // Never put external API response content into logs or user-facing messages.
    throw new Error(`Brevo transactional email request failed (HTTP ${response.status}).`);
  }
}

export async function sendAdminProviderApplicationEmail(application: ProviderApplicationEmail) {
  const adminEmail = process.env.MECATREX_ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error("Missing MECATREX_ADMIN_EMAIL in the server environment.");
  }

  const type = application.providerType === "garage" ? "Garage" : "Towing service";

  await sendBrevoEmail({
    toEmail: adminEmail,
    toName: "MECATREX Admin",
    subject: `New ${type} application — ${application.businessName}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#101828;line-height:1.6">
        <h2>New MECATREX provider application</h2>
        <p>A new service provider has submitted an application.</p>
        <p>
          <strong>Type:</strong> ${escapeHtml(type)}<br />
          <strong>Business:</strong> ${escapeHtml(application.businessName)}<br />
          <strong>Owner/contact:</strong> ${escapeHtml(application.firstName)} ${escapeHtml(application.lastName)}<br />
          <strong>Email:</strong> ${escapeHtml(application.email)}<br />
          <strong>Phone:</strong> ${escapeHtml(application.primaryPhone)}<br />
          <strong>Secondary phone:</strong> ${escapeHtml(application.secondaryPhone || "Not provided")}
        </p>
        <p>
          <strong>Address:</strong><br />
          ${escapeHtml(application.businessAddress)}<br />
          ${escapeHtml(application.city)}, ${escapeHtml(application.province)} ${escapeHtml(application.postalCode)}
        </p>
        <p style="margin:24px 0"><a href="${escapeHtml(appUrl("/admin?view=review#applications"))}" style="display:inline-block;background:#4771A6;padding:12px 20px;border-radius:10px;color:white;text-decoration:none;font-weight:bold">Review provider application</a></p>
        <p>This notification was sent because a new provider application was submitted on MECATREX. The application requires your decision.</p>
      </div>
    `,
  });
}

export async function sendProviderDecisionEmail(data: ProviderDecisionEmail) {
  const copy = {
    approved: {
      subject: "Your MECATREX provider account has been approved",
      heading: "Welcome to MECATREX",
      description: "Your business has been approved. You can now log in, complete your business profile, upload your photo and publish your services. Your listing becomes public once at least one active service has a confirmed fixed price.",
    },
    needs_information: {
      subject: "More information is needed for your MECATREX application",
      heading: "We need a little more information",
      description: "We need additional information to complete your business review. Please read the note below and reply to this email, or contact MECATREX support. You can continue editing your profile while the application is on hold.",
    },
    rejected: {
      subject: "Update regarding your MECATREX provider application",
      heading: "Application update",
      description: "We are unable to approve your business application at this time. See the decision details below. You can still log in to view your account, but your business will not be published.",
    },
  }[data.status];

  const message = data.message?.trim();

  await sendBrevoEmail({
    toEmail: data.email,
    toName: data.firstName,
    subject: copy.subject,
    html: `
      <div style="font-family:Arial,sans-serif;color:#101828;line-height:1.6">
        <h2>${escapeHtml(copy.heading)}</h2>
        <p>Hi ${escapeHtml(data.firstName)},</p>
        <p>${escapeHtml(copy.description)}</p>
        <p><strong>Business:</strong> ${escapeHtml(data.businessName)}</p>
        <p><strong>Decision:</strong> ${escapeHtml(data.status.replaceAll("_", " "))}</p>
        ${message ? `<div style="padding:16px;border-radius:12px;background:#f5f7fa"><strong>Message from MECATREX:</strong><br />${escapeHtml(message)}</div>` : ""}
        <p style="margin:24px 0"><a href="${escapeHtml(appUrl("/account"))}" style="display:inline-block;background:#4771A6;padding:12px 20px;border-radius:10px;color:white;text-decoration:none;font-weight:bold">Open your MECATREX account</a></p>
        <p>If you have questions, you can reply to our team using the contact information provided by MECATREX.</p>
        <p>— MECATREX</p>
      </div>
    `,
  });
}
