type ProviderApplicationEmail = {
  firstName: string;
  lastName: string;
  email: string;
  primaryPhone: string;
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
    console.warn("Brevo is not configured. Email skipped.");
    return;
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
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Brevo error: ${await response.text()}`);
  }
}

export async function sendAdminProviderApplicationEmail(application: ProviderApplicationEmail) {
  const adminEmail = process.env.MECATREX_ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("MECATREX_ADMIN_EMAIL is not configured.");
    return;
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
          <strong>Phone:</strong> ${escapeHtml(application.primaryPhone)}
        </p>
        <p>
          <strong>Address:</strong><br />
          ${escapeHtml(application.businessAddress)}<br />
          ${escapeHtml(application.city)}, ${escapeHtml(application.province)} ${escapeHtml(application.postalCode)}
        </p>
        <p>Open the MECATREX Admin dashboard to approve, request additional information, or decline the application.</p>
      </div>
    `,
  });
}

export async function sendProviderDecisionEmail(data: ProviderDecisionEmail) {
  const copy = {
    approved: {
      subject: "Your MECATREX provider account has been approved",
      heading: "Welcome to MECATREX",
      description: "Your service provider application has been approved. Your business can now appear on MECATREX.",
    },
    needs_information: {
      subject: "More information is needed for your MECATREX application",
      heading: "We need a little more information",
      description: "Your MECATREX application is still under review. We need some additional information before we can approve it.",
    },
    rejected: {
      subject: "Update regarding your MECATREX provider application",
      heading: "Application update",
      description: "We were unable to approve your service provider application at this time.",
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
        <p><strong>${escapeHtml(data.businessName)}</strong></p>
        ${message ? `<div style="padding:16px;border-radius:12px;background:#f5f7fa">${escapeHtml(message)}</div>` : ""}
        <p>— MECATREX</p>
      </div>
    `,
  });
}
