
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/account/actions";
import {
  removeProvider,
  resendAdminApplicationEmail,
  resendProviderDecisionEmail,
  setProviderStatus,
} from "./actions";
import AccentPicker from "@/components/account/accent-picker";
import type { AccentColor } from "@/lib/booking";

export const dynamic = "force-dynamic";

type ProviderRow = {
  id: string;
  owner_id: string;
  provider_type: "garage" | "towing";
  business_name: string;
  address_line1: string;
  city: string;
  province: string;
  postal_code: string;
  status: "pending" | "approved" | "needs_information" | "rejected";
  business_description: string | null;
  public_email: string | null;
  public_phone: string | null;
  website: string | null;
  is_removed: boolean;
  is_listing_active: boolean;
  booking_suspended: boolean;
  provider_cancellation_count: number;
  created_at: string;
};

type ApplicationRow = {
  provider_id: string;
  business_neq: string | null;
  application_services: string[];
};

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  primary_phone: string;
  account_type: "client" | "provider" | "admin";
  created_at: string;
};

const registryUrl =
  "https://www.quebec.ca/entreprises-et-travailleurs-autonomes/obtenir-renseignements-entreprise/recherche-registre-entreprises/acceder-registre-entreprises";

function statusStyle(status: ProviderRow["status"]) {
  return {
    pending: "bg-[#FFF7E8] text-[#92400E]",
    approved: "bg-[#ECFDF3] text-[#027A48]",
    needs_information: "bg-[#EFF6FF] text-[#1D4ED8]",
    rejected: "bg-[#FEF3F2] text-[#B42318]",
  }[status];
}

function PhoneLink({ number }: { number?: string | null }) {
  if (!number) {
    return <span className="text-[#98A2B3]">Not provided</span>;
  }

  return (
    <a
      href={`tel:${number.replace(/[^\d+]/g, "")}`}
      className="font-semibold text-[#315C91] underline underline-offset-2"
    >
      {number}
    </a>
  );
}

function EmailLink({ email }: { email?: string | null }) {
  if (!email) {
    return <span className="text-[#98A2B3]">Not provided</span>;
  }

  return (
    <a
      href={`mailto:${email}`}
      className="break-all font-semibold text-[#315C91] underline underline-offset-2"
    >
      {email}
    </a>
  );
}

function DataField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
        {label}
      </p>
      <div className="mt-1 break-words text-[13px] font-medium text-[#101828]">
        {children}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  owner,
  application,
}: {
  provider: ProviderRow;
  owner?: ProfileRow;
  application?: ApplicationRow;
}) {
  const needsReview =
    provider.status === "pending" ||
    provider.status === "needs_information";

  const ownerName = owner
    ? `${owner.first_name} ${owner.last_name}`.trim()
    : "Not found";

  return (
    <details
      id={`provider-${provider.id}`}
      className={`meca-accordion scroll-mt-8 overflow-hidden rounded-[19px] border bg-white shadow-sm transition ${
        needsReview
          ? "portal-provider-urgent border-[#93B4DC]"
          : "border-[#D6E0ED]"
      }`}
    >
      <summary className="relative cursor-pointer px-4 py-4 pr-14 sm:px-5 sm:py-5 sm:pr-16">
        <span
          aria-hidden="true"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#CAD6E5] bg-[#EDF3FA] text-[23px] font-semibold text-[#315C91]"
        >
          <span className="meca-plus">+</span>
          <span className="meca-minus">−</span>
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[18px] font-extrabold text-[#101828] sm:text-[20px]">
            {provider.business_name}
          </h3>

          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${statusStyle(
              provider.status
            )}`}
          >
            {provider.status.replaceAll("_", " ")}
          </span>

          <span className="rounded-full bg-[#EDF3FA] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#315C91]">
            {provider.provider_type}
          </span>

          {provider.is_removed && (
            <span className="rounded-full bg-[#FEF3F2] px-2.5 py-1 text-[10px] font-bold text-[#B42318]">
              Removed
            </span>
          )}

          {provider.is_listing_active && (
            <span className="rounded-full bg-[#ECFDF3] px-2.5 py-1 text-[10px] font-bold text-[#027A48]">
              Published
            </span>
          )}
        </div>

        <p className="mt-2 text-[13px] leading-5 text-[#667085]">
          📍 {provider.address_line1}, {provider.city},{" "}
          {provider.province} {provider.postal_code}
        </p>

        <div className="portal-summary-card mt-3 grid gap-x-5 gap-y-3 rounded-[13px] border border-[#E4E7EC] bg-[#F8FAFC] p-3 sm:grid-cols-2">
          <DataField label="Owner">{ownerName}</DataField>

          <DataField label="Account email">
            {owner?.email || "Not provided"}
          </DataField>

          <DataField label="Account phone">
            {owner?.primary_phone || "Not provided"}
          </DataField>

          <DataField label="Public phone">
            {provider.public_phone || "Not provided"}
          </DataField>

          <div className="sm:col-span-2">
            <DataField label="Public email">
              {provider.public_email || "Not provided"}
            </DataField>
          </div>
        </div>
      </summary>

      <div className="border-t border-[#D6E0ED] px-4 pb-5 pt-5 sm:px-5">
        {provider.business_description && (
          <p className="mb-4 whitespace-pre-wrap text-[13px] leading-6 text-[#475467]">
            {provider.business_description}
          </p>
        )}

        <div className="grid gap-3 rounded-[15px] border border-[#E4E7EC] bg-white p-4 text-[13px] sm:grid-cols-2">
          <DataField label="Owner">
            {ownerName}
          </DataField>

          <DataField label="Account email">
            <EmailLink email={owner?.email} />
          </DataField>

          <DataField label="Account phone">
            <PhoneLink number={owner?.primary_phone} />
          </DataField>

          <DataField label="Public phone">
            <PhoneLink number={provider.public_phone} />
          </DataField>

          <DataField label="Public email">
            <EmailLink email={provider.public_email} />
          </DataField>

          <DataField label="Application submitted">
            {new Date(provider.created_at).toLocaleDateString("en-CA")}
          </DataField>

          {provider.provider_type === "garage" && (
            <DataField label="Garage cancellations">
              {provider.provider_cancellation_count} / 3
              {provider.booking_suspended
                ? " · Booking suspended"
                : ""}
            </DataField>
          )}
        </div>

        <section className="portal-summary-card mt-4 rounded-[16px] border border-[#D6E0ED] bg-[#F8FAFD] p-4 sm:p-5">
          <h4 className="text-[15px] font-extrabold text-[#101828]">
            Business verification dossier
          </h4>

          <div className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2">
            <DataField label="Quebec NEQ">
              {application?.business_neq || "Not provided"}
            </DataField>

            <DataField label="Website">
              {provider.website ? (
                <a
                  href={provider.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-semibold text-[#315C91] underline"
                >
                  {provider.website}
                </a>
              ) : (
                "Not provided"
              )}
            </DataField>
          </div>

          <div className="mt-4">
            <DataField label="Planned services">
              {application?.application_services?.length
                ? application.application_services.join(" · ")
                : "Not provided"}
            </DataField>
          </div>

          <a
            href={registryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-[13px] font-bold text-[#315C91] underline"
          >
            Verify NEQ in Quebec enterprise registry ↗
          </a>

          <form
            action={resendAdminApplicationEmail}
            className="mt-4"
          >
            <input
              type="hidden"
              name="provider_id"
              value={provider.id}
            />

            <button
              type="submit"
              className="rounded-xl border border-[#93B4DC] bg-white px-4 py-2.5 text-[12px] font-bold text-[#315C91] transition hover:bg-[#EAF1F9]"
            >
              ↻ Resend detailed application email to admin
            </button>
          </form>
        </section>

        {!provider.is_removed && (
          <form
            action={setProviderStatus}
            className="mt-4 rounded-[16px] border border-[#D0D5DD] bg-[#F8FAFC] p-4"
          >
            <input
              type="hidden"
              name="provider_id"
              value={provider.id}
            />

            <label className="block">
              <span className="mb-2 block text-[13px] font-bold text-[#101828]">
                Message to provider
              </span>

              <p className="mb-3 text-[12px] leading-5 text-[#667085]">
                Required when rejecting an application or requesting
                additional information.
              </p>

              <textarea
                name="message"
                rows={3}
                placeholder="Explain your decision or the information you need..."
                className="w-full rounded-[13px] border border-[#CBD5E1] bg-white px-4 py-3 text-[14px] text-[#101828] outline-none focus:border-[#4771A6]"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                name="status"
                value="approved"
                disabled={provider.status === "approved"}
                className="rounded-xl bg-[#027A48] px-4 py-3 text-[13px] font-bold text-white transition hover:bg-[#05603A] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ✓ Approve
              </button>

              <button
                type="submit"
                name="status"
                value="needs_information"
                className="rounded-xl bg-[#4771A6] px-4 py-3 text-[13px] font-bold text-white transition hover:bg-[#315C91]"
              >
                Request more info
              </button>

              <button
                type="submit"
                name="status"
                value="rejected"
                disabled={provider.status === "rejected"}
                className="rounded-xl border border-[#FDA29B] bg-white px-4 py-3 text-[13px] font-bold text-[#B42318] transition hover:bg-[#FEF3F2] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </form>
        )}

        {!provider.is_removed && (
          <form
            action={removeProvider}
            className="mt-4 rounded-[16px] border border-[#FDA29B] bg-[#FFF9F8] p-4"
          >
            <input
              type="hidden"
              name="provider_id"
              value={provider.id}
            />

            <label className="block text-[13px] font-bold text-[#B42318]">
              Remove this provider from MECATREX

              <textarea
                name="removal_reason"
                required
                minLength={10}
                rows={2}
                placeholder="Reason for removal (at least 10 characters)"
                className="mt-2 w-full rounded-xl border border-[#FDA29B] bg-white px-4 py-3 text-[13px] text-[#101828]"
              />
            </label>

            <button
              type="submit"
              className="mt-3 rounded-xl bg-[#B42318] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#912018]"
            >
              Remove and unpublish
            </button>

            <p className="mt-2 text-[12px] leading-5 text-[#667085]">
              Historical bookings and reviews are retained. Contact
              customers about upcoming appointments.
            </p>
          </form>
        )}

        {provider.status !== "pending" && (
          <form
            action={resendProviderDecisionEmail}
            className="mt-4 flex flex-wrap items-center gap-3"
          >
            <input
              type="hidden"
              name="provider_id"
              value={provider.id}
            />

            <button
              type="submit"
              className="rounded-xl border border-[#98A2B3] bg-white px-4 py-2.5 text-[13px] font-bold text-[#315C91] hover:bg-[#EDF3FA]"
            >
              ↻ Resend decision email
            </button>

            <span className="text-[12px] text-[#667085]">
              Sends the current decision to the provider.
            </span>
          </form>
        )}
      </div>
    </details>
  );
}

function AccountCard({
  account,
  provider,
}: {
  account: ProfileRow;
  provider?: ProviderRow;
}) {
  return (
    <details className="meca-accordion overflow-hidden rounded-[16px] border border-[#D6E0ED] bg-white">
      <summary className="relative cursor-pointer px-4 py-4 pr-14 sm:px-5">
        <span
          aria-hidden="true"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg border border-[#CBD5E1] bg-[#EDF3FA] text-[23px] font-semibold text-[#315C91]"
        >
          <span className="meca-plus">+</span>
          <span className="meca-minus">−</span>
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-bold text-[#101828]">
            {account.first_name} {account.last_name}
          </h3>

          <span className="rounded-full bg-[#EDF3FA] px-2.5 py-1 text-[10px] font-bold uppercase text-[#315C91]">
            {account.account_type}
          </span>
        </div>

        <p className="mt-1 break-all text-[13px] text-[#667085]">
          {account.email}
        </p>

        {provider && (
          <p className="mt-1 text-[12px] text-[#667085]">
            {provider.business_name} · {provider.status.replaceAll("_", " ")}
          </p>
        )}
      </summary>

      <div className="grid gap-4 border-t border-[#E4E7EC] bg-[#F8FAFC] p-4 sm:grid-cols-2 sm:p-5">
        <DataField label="Account email">
          <EmailLink email={account.email} />
        </DataField>

        <DataField label="Account phone">
          <PhoneLink number={account.primary_phone} />
        </DataField>

        <DataField label="Account type">
          {account.account_type}
        </DataField>

        <DataField label="Joined">
          {new Date(account.created_at).toLocaleDateString("en-CA")}
        </DataField>

        {provider && (
          <>
            <DataField label="Business">
              {provider.business_name}
            </DataField>

            <DataField label="Business status">
              {provider.status.replaceAll("_", " ")}
            </DataField>
          </>
        )}
      </div>
    </details>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    warning?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const adminEmail =
    process.env.MECATREX_ADMIN_EMAIL?.trim() ||
    "RaselChowdhury12345@hotmail.com";

  const loginQuery = new URLSearchParams({
    next: "/admin#applications",
    email: adminEmail,
  });

  const adminLoginUrl = `/login?${loginQuery.toString()}`;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(adminLoginUrl);
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("account_type, accent_color, email")
    .eq("id", user.id)
    .single();

  if (currentProfile?.account_type !== "admin") {
    redirect(adminLoginUrl);
  }

  const [
    { data: providerRows, error: providerError },
    { data: profileRows, error: accountsError },
    { data: applicationRows, error: applicationError },
  ] = await Promise.all([
    supabase
      .from("service_providers")
      .select(
        "id, owner_id, provider_type, business_name, address_line1, city, province, postal_code, status, business_description, public_email, public_phone, website, is_removed, is_listing_active, booking_suspended, provider_cancellation_count, created_at"
      )
      .order("created_at", { ascending: false }),

    supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, email, primary_phone, account_type, created_at"
      )
      .order("created_at", { ascending: false }),

    supabase
      .from("provider_applications")
      .select("provider_id, business_neq, application_services"),
  ]);

  const providers = (providerRows ?? []) as ProviderRow[];
  const accounts = (profileRows ?? []) as ProfileRow[];
  const applications = (applicationRows ?? []) as ApplicationRow[];

  const ownerMap = new Map(
    accounts.map((account) => [account.id, account])
  );

  const providerMap = new Map(
    providers.map((provider) => [provider.owner_id, provider])
  );

  const applicationMap = new Map(
    applications.map((application) => [
      application.provider_id,
      application,
    ])
  );

  const pending = providers.filter(
    (provider) =>
      !provider.is_removed &&
      (provider.status === "pending" ||
        provider.status === "needs_information")
  );

  const filtered = [
    ...pending,
    ...providers.filter(
      (provider) =>
        !pending.some((pendingProvider) => pendingProvider.id === provider.id)
    ),
  ];

  const accent = (currentProfile.accent_color || "blue") as AccentColor;

  const clientsCount = accounts.filter(
    (account) => account.account_type === "client"
  ).length;

  const businessCount = accounts.filter(
    (account) => account.account_type === "provider"
  ).length;

  const brevoConfigured = Boolean(
    process.env.BREVO_API_KEY &&
      process.env.BREVO_SENDER_EMAIL &&
      process.env.MECATREX_ADMIN_EMAIL
  );

  return (
    <main
      className="portal-theme min-h-screen px-4 py-8 text-[#101828] sm:px-6"
      data-portal-theme={accent}
    >
      <style>{`
        .meca-accordion > summary {
          list-style: none;
        }

        .meca-accordion > summary::-webkit-details-marker {
          display: none;
        }

        .meca-accordion .meca-minus {
          display: none;
        }

        .meca-accordion[open] > summary .meca-plus {
          display: none;
        }

        .meca-accordion[open] > summary .meca-minus {
          display: inline;
        }

        .meca-accordion[open] {
          border-color: var(--portal-accent, #4771A6);
          box-shadow: 0 8px 24px rgba(16, 24, 40, 0.06);
        }

        .meca-accordion > summary:focus-visible {
          outline: 3px solid var(--portal-accent, #4771A6);
          outline-offset: -3px;
          border-radius: 14px;
        }
      `}</style>

      <div className="mx-auto max-w-[1250px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" aria-label="MECATREX homepage">
            <Image
              src="/mecatrex-logo-web.png"
              alt="MECATREX"
              width={260}
              height={74}
              priority
              className="h-[52px] w-auto"
            />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-[#BAC7D7] bg-white px-5 py-3 text-[13px] font-bold text-[#344054] hover:bg-[#EDF3FA]"
            >
              ← MECATREX home
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                className="rounded-xl border border-[#BAC7D7] bg-white px-5 py-3 text-[13px] font-bold text-[#344054] hover:bg-[#EDF3FA]"
              >
                Log out
              </button>
            </form>
          </div>
        </header>

        <div className="portal-main-card mt-7 rounded-[28px] border border-[#E4E7EC] bg-white p-6 shadow-[0_16px_50px_rgba(16,24,40,0.06)] sm:p-9">
          <p className="portal-kicker text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">
            MECATREX administration
          </p>

          <h1 className="mt-2 text-[30px] font-bold tracking-[-0.04em] sm:text-[42px]">
            Marketplace command center
          </h1>

          <p className="mt-2 text-[14px] leading-6 text-[#667085]">
            Manage applications, garages, towing providers and registered
            accounts from one dashboard.
          </p>

          <AccentPicker
            userId={user.id}
            initialAccent={accent}
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <a
              href="#applications"
              className="portal-feature-banner rounded-[18px] border border-[#BAC7D7] bg-[#101828] p-5 text-white"
            >
              <p className="text-[12px] font-bold uppercase tracking-wide">
                Applications awaiting review
              </p>
              <p className="mt-2 text-[32px] font-extrabold">
                {pending.length}
              </p>
            </a>

            <a
              href="#businesses"
              className="portal-summary-card rounded-[18px] border border-[#BAC7D7] bg-[#F8FAFC] p-5"
            >
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#667085]">
                Registered businesses
              </p>
              <p className="mt-2 text-[32px] font-extrabold">
                {businessCount}
              </p>
            </a>

            <a
              href="#accounts"
              className="portal-summary-card rounded-[18px] border border-[#BAC7D7] bg-[#F8FAFC] p-5"
            >
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#667085]">
                Client accounts
              </p>
              <p className="mt-2 text-[32px] font-extrabold">
                {clientsCount}
              </p>
            </a>
          </div>

          {!brevoConfigured && (
            <div
              role="alert"
              className="mt-5 rounded-[16px] border border-[#FEC84B] bg-[#FFFAEB] p-4 text-[13px] leading-6 text-[#92400E]"
            >
              <strong>Email notifications are not fully configured.</strong>
              {" "}Verify BREVO_API_KEY, BREVO_SENDER_EMAIL and
              MECATREX_ADMIN_EMAIL in your server environment.
            </div>
          )}

          {params.success && (
            <div
              role="status"
              className="mt-5 rounded-[14px] bg-[#ECFDF3] p-4 text-[13px] font-semibold text-[#027A48]"
            >
              {params.success}
            </div>
          )}

          {params.warning && (
            <div
              role="alert"
              className="mt-5 rounded-[14px] bg-[#FFFAEB] p-4 text-[13px] font-semibold text-[#92400E]"
            >
              {params.warning}
            </div>
          )}

          {params.error && (
            <div
              role="alert"
              className="mt-5 rounded-[14px] bg-[#FEF3F2] p-4 text-[13px] font-semibold text-[#B42318]"
            >
              {params.error}
            </div>
          )}

          <nav className="mt-7 flex flex-wrap gap-2 border-b border-[#E4E7EC] pb-4">
            <a href="#applications" className="portal-jump-link">
              Needs review ({pending.length})
            </a>
            <a href="#businesses" className="portal-jump-link">
              Businesses ({providers.length})
            </a>
            <a href="#accounts" className="portal-jump-link">
              Accounts ({accounts.length})
            </a>
          </nav>

          <section
            id="applications"
            className="portal-section mt-8 scroll-mt-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="portal-section-heading text-[23px] font-bold">
                Applications needing attention
              </h2>

              <span className="rounded-full bg-[#EDF3FA] px-4 py-2 text-[12px] font-bold text-[#344054]">
                {pending.length} awaiting action
              </span>
            </div>

            <p className="mt-2 text-[13px] text-[#667085]">
              Select an application below to open its full verification
              dossier.
            </p>

            {pending.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {pending.map((provider) => (
                  <a
                    key={provider.id}
                    href={`#provider-${provider.id}`}
                    className="portal-summary-card rounded-[15px] border border-[#BAC7D7] bg-[#F8FAFC] p-4 transition hover:shadow-md"
                  >
                    <p className="font-bold text-[#101828]">
                      {provider.business_name}
                    </p>

                    <p className="mt-1 text-[12px] capitalize text-[#667085]">
                      {provider.provider_type} ·{" "}
                      {provider.status.replaceAll("_", " ")}
                    </p>

                    <p className="mt-2 text-[12px] font-bold text-[#315C91]">
                      View business and expand with + ↓
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[15px] border border-dashed border-[#BAC7D7] bg-[#F8FAFC] p-6 text-center">
                <p className="text-[14px] font-semibold text-[#475467]">
                  ✓ Nothing needs review right now.
                </p>
              </div>
            )}
          </section>

          <section
            id="businesses"
            className="portal-section mt-10 scroll-mt-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="portal-section-heading text-[23px] font-bold">
                  Business applications & providers
                </h2>

                <p className="mt-2 text-[13px] text-[#667085]">
                  Click + to expand a business and − to minimize it.
                  Pending applications appear first.
                </p>
              </div>

              <span className="rounded-full bg-[#EDF3FA] px-4 py-2 text-[12px] font-bold text-[#344054]">
                {providers.length} businesses
              </span>
            </div>

            {applicationError && (
              <p role="alert" className="mt-4 text-[13px] text-[#B42318]">
                Verification data unavailable: {applicationError.message}
              </p>
            )}

            {providerError && (
              <p role="alert" className="mt-4 text-[13px] text-[#B42318]">
                Could not load providers: {providerError.message}
              </p>
            )}

            <div className="mt-5 space-y-3">
              {filtered.length === 0 && !providerError && (
                <div className="rounded-[18px] border border-dashed border-[#BAC7D7] bg-[#F8FAFC] p-8 text-center">
                  <p className="font-bold text-[#344054]">
                    No provider accounts yet.
                  </p>
                </div>
              )}

              {filtered.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  owner={ownerMap.get(provider.owner_id)}
                  application={applicationMap.get(provider.id)}
                />
              ))}
            </div>
          </section>

          <section
            id="accounts"
            className="portal-section mt-10 scroll-mt-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="portal-section-heading text-[23px] font-bold">
                  Registered accounts
                </h2>

                <p className="mt-2 text-[13px] text-[#667085]">
                  Click + to view account details.
                </p>
              </div>

              <span className="rounded-full bg-[#EDF3FA] px-4 py-2 text-[12px] font-bold text-[#344054]">
                {accounts.length} accounts
              </span>
            </div>

            {accountsError && (
              <p role="alert" className="mt-4 text-[13px] text-[#B42318]">
                Could not load accounts: {accountsError.message}
              </p>
            )}

            <div className="mt-5 space-y-3">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  provider={providerMap.get(account.id)}
                />
              ))}

              {accounts.length === 0 && !accountsError && (
                <p className="rounded-[15px] border border-dashed border-[#BAC7D7] p-6 text-center text-[13px] text-[#667085]">
                  No accounts found.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
