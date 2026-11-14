
type ProviderApplicationEmail = {
  firstName: string;
  lastName: string;
  email: string;
  primaryPhone: string;
  secondaryPhone?: string;
  providerType: "garage" | "towing";
  businessName: string;
  businessNEQ: string;
  businessPhone: string;
  businessWebsite: string;
  applicationServices: string[];
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
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";

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
    throw new Error(
      "Missing BREVO_API_KEY or BREVO_SENDER_EMAIL."
    );
  }

  if (!apiKey.startsWith("xkeysib-")) {
    throw new Error(
      "BREVO_API_KEY must be a Brevo v3 API key."
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    throw new Error(
      "BREVO_SENDER_EMAIL must be a verified email address."
    );
  }

  const response = await fetch(
    "https://api.brevo.com/v3/smtp/email",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "MECATREX",
          email: senderEmail,
        },
        to: [{ email: toEmail, name: toName }],
        ...(process.env.MECATREX_ADMIN_EMAIL
          ? {
              replyTo: {
                email: process.env.MECATREX_ADMIN_EMAIL,
              },
            }
          : {}),
        subject,
        htmlContent: html,
      }),
    }
  );

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const details =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message.slice(0, 180)
        : "";

    throw new Error(
      `Brevo rejected email (HTTP ${response.status}) ${details}`
    );
  }

  const messageId =
    payload &&
    typeof payload === "object" &&
    "messageId" in payload &&
    typeof payload.messageId === "string"
      ? payload.messageId
      : null;

  return messageId;
}

export async function sendAdminProviderApplicationEmail(
  application: ProviderApplicationEmail
) {
  const adminEmail = process.env.MECATREX_ADMIN_EMAIL;

  if (!adminEmail) {
    throw new Error("MECATREX_ADMIN_EMAIL is missing.");
  }

  const type =
    application.providerType === "garage"
      ? "Garage"
      : "Towing service";

  return sendBrevoEmail({
    toEmail: adminEmail,
    toName: "MECATREX Admin",
    subject: `New ${type} application — ${application.businessName}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#101828;line-height:1.7;max-width:680px;margin:auto">
        <h2>New MECATREX provider application</h2>
        <p>A new service provider has submitted an application for review.</p>
        <div style="padding:18px;background:#f4f7fb;border:1px solid #d7e2ef;border-radius:12px">
          <p><strong>Type:</strong> ${escapeHtml(type)}</p>
          <p><strong>Business:</strong> ${escapeHtml(application.businessName)}</p>
          <p><strong>Owner:</strong> ${escapeHtml(application.firstName)} ${escapeHtml(application.lastName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(application.email)}</p>
          <p><strong>Primary phone:</strong> ${escapeHtml(application.primaryPhone)}</p>
          <p><strong>Secondary phone:</strong> ${escapeHtml(application.secondaryPhone || "Not provided")}</p>
          <p><strong>Business phone:</strong> ${escapeHtml(application.businessPhone)}</p>
          <p><strong>NEQ:</strong> ${escapeHtml(application.businessNEQ)}</p>
          <p><strong>Address:</strong> ${escapeHtml(application.businessAddress)}, ${escapeHtml(application.city)}, ${escapeHtml(application.province)} ${escapeHtml(application.postalCode)}</p>
          <p><strong>Website:</strong> ${escapeHtml(application.businessWebsite || "Not provided")}</p>
          <p><strong>Planned services:</strong></p>
          <ul>${application.applicationServices.map((service) => `<li>${escapeHtml(service)}</li>`).join("")}</ul>
          <p><strong>Business photo and hours:</strong> Available in the admin verification dossier.</p>
        </div>
        <p>Verify the company's NEQ, submitted photo, opening hours and services before making a decision.</p>
        <p style="margin:24px 0">
          <a href="${escapeHtml(appUrl("/admin?view=review#applications"))}" style="display:inline-block;background:#4771A6;padding:13px 20px;border-radius:10px;color:#fff;text-decoration:none;font-weight:bold">
            Review provider application
          </a>
        </p>
        <p>This application requires an administrator's decision.</p>
      </div>
    `,
  });
}

export async function sendProviderDecisionEmail(
  data: ProviderDecisionEmail
) {
  const copy = {
    approved: {
      subject: "Your MECATREX provider account has been approved",
      heading: "Welcome to MECATREX!",
      description:
        "Your business has been approved. Your submitted photo, business information, selected services and opening hours are already saved in your account. You can now set the fixed prices and estimated durations for your services, then publish your listing when ready.",
    },
    needs_information: {
      subject: "More information is needed for your MECATREX application",
      heading: "More information requested",
      description:
        "MECATREX needs additional information before making a decision. Please read the message below. Your application remains under review until the required information has been received.",
    },
    rejected: {
      subject: "Update regarding your MECATREX application",
      heading: "Application update",
      description:
        "We are unable to approve your business application at this time. Your listing will not be published. Please review the decision below.",
    },
  }[data.status];

  const message = data.message?.trim();

  return sendBrevoEmail({
    toEmail: data.email,
    toName: data.firstName,
    subject: copy.subject,
    html: `
      <div style="font-family:Arial,sans-serif;color:#101828;line-height:1.7;max-width:640px;margin:auto">
        <h2>${escapeHtml(copy.heading)}</h2>
        <p>Hello ${escapeHtml(data.firstName)},</p>
        <p>${escapeHtml(copy.description)}</p>
        <p><strong>Business:</strong> ${escapeHtml(data.businessName)}</p>
        <p><strong>Status:</strong> ${escapeHtml(data.status.replaceAll("_", " "))}</p>
        ${
          message
            ? `<div style="padding:16px;background:#f4f7fb;border-radius:12px"><strong>Message from MECATREX:</strong><p style="white-space:pre-wrap">${escapeHtml(message)}</p></div>`
            : ""
        }
        <p style="margin:24px 0">
          <a href="${escapeHtml(appUrl("/account"))}" style="display:inline-block;background:#4771A6;padding:13px 20px;border-radius:10px;color:white;text-decoration:none;font-weight:bold">
            Open your MECATREX account
          </a>
        </p>
        <p>If you have questions, reply to this email.</p>
        <p>— MECATREX</p>
      </div>
    `,
  });
}

type BookingEmailEvent = {
  event: "confirmed" | "provider_cancelled" | "client_cancelled";
  clientEmail: string;
  clientName: string;
  providerEmail: string;
  providerName: string;
  serviceName: string;
  vehicleDescription: string;
  startsAt: string;
  endsAt: string;
};

export async function sendBookingEmailNotifications(
  data: BookingEmailEvent
) {
  const start = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(data.startsAt));

  const end = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    timeStyle: "short",
  }).format(new Date(data.endsAt));

  const cancelled = data.event !== "confirmed";

  const clientMessage = cancelled
    ? data.event === "provider_cancelled"
      ? `${data.providerName} cancelled your appointment. You can book another garage on MECATREX.`
      : "Your appointment was cancelled as requested."
    : `Your ${data.serviceName} appointment at ${data.providerName} is confirmed.`;

  const providerMessage = cancelled
    ? data.event === "provider_cancelled"
      ? "You cancelled a confirmed booking. Your cancellation count has been updated."
      : `${data.clientName} cancelled their appointment.`
    : `New booking from ${data.clientName} for ${data.serviceName}.`;

  const mail = (
    title: string,
    message: string,
    link: string
  ) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#101828;line-height:1.6">
      <p style="color:#4771A6;font-weight:bold;letter-spacing:2px">MECATREX</p>
      <h1 style="font-size:24px">${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <div style="padding:18px;background:#f5f7fa;border-radius:14px">
        <strong>Service:</strong> ${escapeHtml(data.serviceName)}<br/>
        ${
          data.vehicleDescription
            ? `<strong>Vehicle:</strong> ${escapeHtml(data.vehicleDescription)}<br/>`
            : ""
        }
        <strong>Garage:</strong> ${escapeHtml(data.providerName)}<br/>
        <strong>Time (Montreal):</strong> ${escapeHtml(start)} – ${escapeHtml(end)}
      </div>
      <p>${
        cancelled
          ? "This appointment has been cancelled."
          : "Payment is handled at the garage. No online charge was made."
      }</p>
      <p style="margin-top:24px">
        <a href="${escapeHtml(appUrl(link))}" style="background:#4771A6;padding:14px 20px;border-radius:12px;color:white;text-decoration:none;font-weight:bold">
          Open your MECATREX account
        </a>
      </p>
    </div>`;

  const tasks = [
    sendBrevoEmail({
      toEmail: data.clientEmail,
      toName: data.clientName,
      subject: cancelled
        ? "MECATREX appointment cancelled"
        : "MECATREX booking confirmed",
      html: mail(
        cancelled ? "Appointment update" : "Your booking is confirmed",
        clientMessage,
        "/account"
      ),
    }),
    sendBrevoEmail({
      toEmail: data.providerEmail,
      toName: data.providerName,
      subject: cancelled
        ? "MECATREX booking cancelled"
        : "New MECATREX garage booking",
      html: mail(
        cancelled ? "Appointment cancelled" : "You have a new appointment",
        providerMessage,
        "/account#garage-calendar"
      ),
    }),
  ];

  const outcomes = await Promise.allSettled(tasks);

  const failed = outcomes.filter(
    (outcome) => outcome.status === "rejected"
  ).length;

  if (failed > 0) {
    console.error(
      "MECATREX booking emails failed for",
      failed,
      "recipient(s)."
    );
  }

  return {
    accepted: tasks.length - failed,
    failed,
  };
}
