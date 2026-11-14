
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/account/actions";
import {
  communicateWithProvider,
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
  image_path: string | null;
  is_removed: boolean;
  is_listing_active: boolean;
  booking_suspended: boolean;
  provider_cancellation_count: number;
  created_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  primary_phone: string;
  account_type: "admin" | "client" | "provider";
  created_at: string;
};

type ApplicationRow = {
  provider_id: string;
  business_neq: string | null;
  application_services: string[];
};

type ServiceRow = {
  id: string;
  provider_id: string;
  name: string;
  price_cents: number | null;
  duration_minutes: number | null;
  is_active: boolean;
};

type HourRow = {
  provider_id: string;
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const registryUrl =
  "https://www.quebec.ca/entreprises-et-travailleurs-autonomes/obtenir-renseignements-entreprise/recherche-registre-entreprises/acceder-registre-entreprises";

const fieldClass =
  "w-full rounded-[12px] border border-[#CBD5E1] bg-white px-4 py-3 text-[13px] text-[#101828] outline-none focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10";

function statusClass(status: ProviderRow["status"]) {
  return {
    pending: "bg-[#FFF4D6] text-[#92400E]",
    approved: "bg-[#ECFDF3] text-[#027A48]",
    needs_information: "bg-[#EFF6FF] text-[#1D4ED8]",
    rejected: "bg-[#FEF3F2] text-[#B42318]",
  }[status];
}

function DataField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#667085]">
        {label}
      </p>
      <div className="mt-1 break-words text-[13px] font-semibold text-[#101828]">
        {children}
      </div>
    </div>
  );
}

function EmailLink({ email }: { email?: string | null }) {
  if (!email) return <span>Not provided</span>;

  return (
    <a
      href={`mailto:${email}`}
      className="break-all text-[#315C91] underline"
    >
      {email}
    </a>
  );
}

function PhoneLink({ number }: { number?: string | null }) {
  if (!number) return <span>Not provided</span>;

  return (
    <a
      href={`tel:${number.replace(/[^\d+]/g, "")}`}
      className="text-[#315C91] underline"
    >
      {number}
    </a>
  );
}

function formatHour(value: string) {
  const [h, m] = value.split(":");
  const hour = Number(h);

  if (!Number.isFinite(hour)) return value;

  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function BusinessCard({
  provider,
  owner,
  application,
  services,
  hours,
  imageUrl,
}: {
  provider: ProviderRow;
  owner?: ProfileRow;
  application?: ApplicationRow;
  services: ServiceRow[];
  hours: HourRow[];
  imageUrl: string;
}) {
  const needsReview =
    provider.status === "pending" ||
    provider.status === "needs_information";

  const approved = provider.status === "approved";

  const ownerName = owner
    ? `${owner.first_name} ${owner.last_name}`.trim()
    : "Not provided";

  return (
    <details
      id={`provider-${provider.id}`}
      className={`group scroll-mt-8 overflow-hidden rounded-[20px] border bg-white shadow-sm ${
        needsReview ? "border-[#93B4DC]" : "border-[#D6E0ED]"
      }`}
    >
      <summary className="relative cursor-pointer list-none px-5 py-5 pr-16 [&::-webkit-details-marker]:hidden">
        <span className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#C9D6E5] bg-[#EDF3FA] text-[21px] font-bold text-[#315C91]">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[19px] font-extrabold text-[#101828]">
            {provider.business_name}
          </h3>

          <span
            className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${statusClass(provider.status)}`}
          >
            {provider.status.replaceAll("_", " ")}
          </span>

          <span className="rounded-full bg-[#EDF3FA] px-3 py-1 text-[10px] font-bold uppercase text-[#315C91]">
            {provider.provider_type}
          </span>

          {provider.is_removed && (
            <span className="rounded-full bg-[#FEF3F2] px-3 py-1 text-[10px] font-bold text-[#B42318]">
              Removed
            </span>
          )}

          {provider.is_listing_active && (
            <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-[10px] font-bold text-[#027A48]">
              Published
            </span>
          )}
        </div>

        <p className="mt-2 text-[12px] text-[#667085]">
          📍 {provider.address_line1}, {provider.city},{" "}
          {provider.province} {provider.postal_code}
        </p>

        <div className="mt-4 grid gap-3 rounded-[13px] border border-[#E4E7EC] bg-[#F8FAFC] p-4 sm:grid-cols-2">
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
          <DataField label="Public email">
            {provider.public_email || "Not provided"}
          </DataField>
        </div>
      </summary>

      <div className="space-y-5 border-t border-[#D6E0ED] p-5">
        <div className="grid gap-5 md:grid-cols-[280px_1fr]">
          <section className="rounded-[16px] border border-[#D6E0ED] bg-[#F8FAFD] p-4">
            <h4 className="text-[14px] font-extrabold">
              📸 Business photo
            </h4>

            {imageUrl ? (
              <div className="relative mt-3 aspect-video overflow-hidden rounded-[12px]">
                <Image
                  src={imageUrl}
                  alt={`Photo of ${provider.business_name}`}
                  fill
                  unoptimized
                  sizes="280px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="mt-3 flex aspect-video items-center justify-center rounded-[12px] bg-[#EAECF0] text-center text-[12px] font-bold text-[#B42318]">
                No photo uploaded
              </div>
            )}
          </section>

          <section className="rounded-[16px] border border-[#D6E0ED] bg-[#F8FAFD] p-4">
            <h4 className="text-[14px] font-extrabold">
              Business verification dossier
            </h4>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DataField label="Quebec NEQ">
                {application?.business_neq || "Not provided"}
              </DataField>

              <DataField label="Application submitted">
                {new Date(provider.created_at).toLocaleDateString("en-CA")}
              </DataField>

              <DataField label="Owner">
                {ownerName}
              </DataField>

              <DataField label="Account email">
                <EmailLink email={owner?.email} />
              </DataField>

              <DataField label="Public phone">
                <PhoneLink number={provider.public_phone} />
              </DataField>

              <DataField label="Public email">
                <EmailLink email={provider.public_email} />
              </DataField>
            </div>

            {provider.website && (
              <p className="mt-4 break-all text-[12px]">
                Website:{" "}
                <a
                  href={provider.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#315C91] underline"
                >
                  {provider.website}
                </a>
              </p>
            )}

            <a
              href={registryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-[12px] font-bold text-[#315C91] underline"
            >
              Verify NEQ in Quebec enterprise registry
            </a>
          </section>
        </div>

        {provider.business_description && (
          <section className="rounded-[15px] border border-[#D6E0ED] p-4">
            <h4 className="text-[13px] font-extrabold">
              Business description
            </h4>
            <p className="mt-2 whitespace-pre-wrap text-[12px] leading-6 text-[#475467]">
              {provider.business_description}
            </p>
          </section>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-[15px] border border-[#D6E0ED] p-4">
            <h4 className="text-[14px] font-extrabold">
              🔧 Selected services
            </h4>

            <div className="mt-3 flex flex-wrap gap-2">
              {(application?.application_services ?? []).map(
                (service, index) => (
                  <span
                    key={`${service}-${index}`}
                    className="rounded-full border border-[#D6E0ED] bg-[#EDF3FA] px-3 py-2 text-[11px] font-semibold text-[#315C91]"
                  >
                    {service}
                  </span>
                )
              )}
            </div>

            {approved && services.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-[#EAECF0] pt-4">
                <p className="text-[11px] font-bold uppercase text-[#667085]">
                  Configured catalogue
                </p>

                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between gap-3 rounded-[10px] bg-[#F8FAFC] p-3 text-[12px]"
                  >
                    <span className="font-bold">{service.name}</span>
                    <span className="text-[#475467]">
                      {service.price_cents == null
                        ? "Price required"
                        : `${(service.price_cents / 100).toFixed(2)} CAD`}
                      {!service.is_active && " · Draft"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[15px] border border-[#D6E0ED] p-4">
            <h4 className="text-[14px] font-extrabold">
              🕒 Submitted business hours
            </h4>

            <div className="mt-3 overflow-hidden rounded-[12px] border border-[#D6E0ED]">
              {WEEKDAYS.map((day, weekday) => {
                const hour = hours.find(
                  (row) => row.weekday === weekday
                );

                return (
                  <div
                    key={day}
                    className="flex items-center justify-between gap-3 border-b border-[#E4E7EC] px-3 py-2.5 text-[12px] last:border-b-0"
                  >
                    <span className="font-bold">{day}</span>
                    {hour?.is_open ? (
                      <span className="font-semibold text-[#027A48]">
                        {formatHour(hour.open_time)} –{" "}
                        {formatHour(hour.close_time)}
                      </span>
                    ) : (
                      <span className="text-[#98A2B3]">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {needsReview && !provider.is_removed && (
          <form
            action={resendAdminApplicationEmail}
            className="flex justify-start"
          >
            <input
              type="hidden"
              name="provider_id"
              value={provider.id}
            />
            <button
              type="submit"
              className="rounded-[10px] border border-[#BAC7D7] bg-white px-4 py-2 text-[12px] font-bold text-[#315C91]"
            >
              Resend detailed application to admin
            </button>
          </form>
        )}

        {!approved && !provider.is_removed && (
          <form
            action={setProviderStatus}
            className="rounded-[16px] border border-[#BAC7D7] bg-[#F8FAFC] p-5"
          >
            <input
              type="hidden"
              name="provider_id"
              value={provider.id}
            />

            <h4 className="text-[16px] font-extrabold">
              Application decision
            </h4>

            <p className="mt-1 text-[12px] text-[#667085]">
              Approve, reject or request additional information before
              the company is accepted.
            </p>

            <textarea
              name="message"
              rows={3}
              placeholder="Message or missing information..."
              className={`${fieldClass} mt-4`}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                name="status"
                value="approved"
                className="rounded-[11px] bg-[#027A48] px-4 py-3 text-[12px] font-bold text-white"
              >
                ✓ Approve
              </button>

              <button
                type="submit"
                name="status"
                value="needs_information"
                className="rounded-[11px] bg-[#4771A6] px-4 py-3 text-[12px] font-bold text-white"
              >
                Request more info
              </button>

              <button
                type="submit"
                name="status"
                value="rejected"
                className="rounded-[11px] border border-[#FDA29B] bg-white px-4 py-3 text-[12px] font-bold text-[#B42318]"
              >
                Reject
              </button>
            </div>
          </form>
        )}

        {approved && !provider.is_removed && (
          <section className="rounded-[17px] border border-[#A4C1DB] bg-[#F0F6FC] p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-[22px]">
                ✉️
              </span>
              <div>
                <h4 className="text-[17px] font-extrabold text-[#101828]">
                  Communicate with provider
                </h4>
                <p className="mt-1 text-[12px] text-[#667085]">
                  Send a message without changing the approval status.
                </p>
              </div>
            </div>

            <form
              action={communicateWithProvider}
              className="mt-4 space-y-3"
            >
              <input
                type="hidden"
                name="provider_id"
                value={provider.id}
              />

              <div>
                <label className="mb-1 block text-[12px] font-bold">
                  To
                </label>
                <input
                  value={owner?.email ?? ""}
                  readOnly
                  className={`${fieldClass} bg-[#E9F0F7]`}
                />
              </div>

              <div>
                <label
                  htmlFor={`subject-${provider.id}`}
                  className="mb-1 block text-[12px] font-bold"
                >
                  Subject *
                </label>
                <input
                  id={`subject-${provider.id}`}
                  name="subject"
                  required
                  minLength={3}
                  maxLength={150}
                  placeholder="Important update about your business"
                  className={fieldClass}
                />
              </div>

              <div>
                <label
                  htmlFor={`message-${provider.id}`}
                  className="mb-1 block text-[12px] font-bold"
                >
                  Message *
                </label>
                <textarea
                  id={`message-${provider.id}`}
                  name="message"
                  required
                  minLength={3}
                  maxLength={3000}
                  rows={4}
                  placeholder="Write your communication here..."
                  className={fieldClass}
                />
              </div>

              <button
                type="submit"
                className="rounded-[11px] bg-[#315C91] px-5 py-3 text-[12px] font-bold text-white hover:bg-[#234674]"
              >
                ✉ Send communication
              </button>
            </form>

            <p className="mt-3 text-[11px] font-semibold text-[#027A48]">
              ✓ Approved status stays unchanged.
            </p>
          </section>
        )}

        {!provider.is_removed && (
          <section className="rounded-[16px] border border-[#FDA29B] bg-[#FFF9F8] p-4">
            <h4 className="text-[13px] font-extrabold text-[#B42318]">
              Remove this business from MECATREX
            </h4>

            <form action={removeProvider} className="mt-3">
              <input
                type="hidden"
                name="provider_id"
                value={provider.id}
              />

              <textarea
                name="removal_reason"
                required
                minLength={10}
                rows={2}
                placeholder="Explain the reason for removal..."
                className={fieldClass}
              />

              <button
                type="submit"
                className="mt-3 rounded-[10px] bg-[#B42318] px-4 py-2.5 text-[12px] font-bold text-white"
              >
                Remove and unpublish
              </button>
            </form>
          </section>
        )}

        {!provider.is_removed && provider.status !== "pending" && (
          <form action={resendProviderDecisionEmail}>
            <input
              type="hidden"
              name="provider_id"
              value={provider.id}
            />
            <button
              type="submit"
              className="rounded-[10px] border border-[#BAC7D7] bg-white px-4 py-2.5 text-[12px] font-bold text-[#315C91]"
            >
              ↻ Resend approval / decision email
            </button>
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
    <details className="group overflow-hidden rounded-[15px] border border-[#D6E0ED] bg-white">
      <summary className="relative cursor-pointer list-none p-4 pr-14 [&::-webkit-details-marker]:hidden">
        <span className="absolute right-4 top-4 rounded-lg bg-[#EDF3FA] px-3 py-1 text-[20px] text-[#315C91]">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>

        <p className="text-[14px] font-bold">
          {account.first_name} {account.last_name}
          <span className="ml-2 rounded-full bg-[#EDF3FA] px-2 py-1 text-[10px] uppercase text-[#315C91]">
            {account.account_type}
          </span>
        </p>
        <p className="mt-1 text-[12px] text-[#667085]">
          {account.email}
        </p>
        {provider && (
          <p className="mt-1 text-[11px] text-[#667085]">
            {provider.business_name} · {provider.status}
          </p>
        )}
      </summary>

      <div className="grid gap-4 border-t border-[#EAECF0] bg-[#F8FAFC] p-4 sm:grid-cols-2">
        <DataField label="Email">
          <EmailLink email={account.email} />
        </DataField>
        <DataField label="Phone">
          <PhoneLink number={account.primary_phone} />
        </DataField>
        <DataField label="Account type">
          {account.account_type}
        </DataField>
        <DataField label="Joined">
          {new Date(account.created_at).toLocaleDateString("en-CA")}
        </DataField>
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

  const loginUrl = `/login?${new URLSearchParams({
    next: "/admin#applications",
    email: adminEmail,
  }).toString()}`;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(loginUrl);

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, accent_color")
    .eq("id", user.id)
    .single();

  if (profile?.account_type !== "admin") {
    redirect("/account");
  }

  const [
    { data: providerData, error: providerError },
    { data: profileData, error: accountsError },
    { data: applicationData, error: applicationError },
    { data: serviceData },
    { data: hourData },
  ] = await Promise.all([
    supabase
      .from("service_providers")
      .select(
        "id, owner_id, provider_type, business_name, address_line1, city, province, postal_code, status, business_description, public_email, public_phone, website, image_path, is_removed, is_listing_active, booking_suspended, provider_cancellation_count, created_at"
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

    supabase
      .from("provider_services")
      .select(
        "id, provider_id, name, price_cents, duration_minutes, is_active"
      ),

    supabase
      .from("garage_business_hours")
      .select(
        "provider_id, weekday, is_open, open_time, close_time"
      ),
  ]);

  const providers = (providerData ?? []) as ProviderRow[];
  const accounts = (profileData ?? []) as ProfileRow[];
  const applications = (applicationData ?? []) as ApplicationRow[];
  const services = (serviceData ?? []) as ServiceRow[];
  const hours = (hourData ?? []) as HourRow[];

  const accountMap = new Map(
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

  const orderedProviders = [
    ...pending,
    ...providers.filter(
      (provider) =>
        !pending.some((item) => item.id === provider.id)
    ),
  ];

  const accent = (profile.accent_color || "blue") as AccentColor;

  const clientsCount = accounts.filter(
    (account) => account.account_type === "client"
  ).length;

  const businessCount = accounts.filter(
    (account) => account.account_type === "provider"
  ).length;

  return (
    <main
      className="portal-theme min-h-screen px-4 py-8 text-[#101828] sm:px-6"
      data-portal-theme={accent}
    >
      <div className="mx-auto max-w-[1250px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" aria-label="MECATREX homepage">
            <Image
              src="/mecatrex-logo-web.png"
              alt="MECATREX"
              width={260}
              height={74}
              priority
              className="h-[50px] w-auto"
            />
          </Link>

          <div className="flex gap-2">
            <Link
              href="/"
              className="rounded-[11px] border border-[#BAC7D7] bg-white px-4 py-3 text-[12px] font-bold"
            >
              ← MECATREX home
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                className="rounded-[11px] border border-[#BAC7D7] bg-white px-4 py-3 text-[12px] font-bold"
              >
                Log out
              </button>
            </form>
          </div>
        </header>

        <div className="portal-main-card mt-7 rounded-[25px] border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#4771A6]">
            MECATREX administration
          </p>

          <h1 className="mt-2 text-[32px] font-extrabold tracking-tight">
            Marketplace command center
          </h1>

          <p className="mt-2 text-[13px] text-[#667085]">
            Review applications, contact approved businesses and manage
            registered accounts in one place.
          </p>

          <AccentPicker userId={user.id} initialAccent={accent} />

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Applications awaiting review",
                count: pending.length,
                href: "#applications",
              },
              {
                label: "Registered businesses",
                count: businessCount,
                href: "#businesses",
              },
              {
                label: "Client accounts",
                count: clientsCount,
                href: "#accounts",
              },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-[16px] border border-[#BAC7D7] bg-[#F5F8FC] p-5 hover:border-[#4771A6]"
              >
                <p className="text-[11px] font-bold text-[#667085]">
                  {item.label}
                </p>
                <p className="mt-2 text-[30px] font-extrabold">
                  {item.count}
                </p>
              </a>
            ))}
          </div>

          {params.success && (
            <div
              role="status"
              className="mt-5 rounded-[12px] bg-[#ECFDF3] p-4 text-[13px] font-bold text-[#027A48]"
            >
              ✓ {params.success}
            </div>
          )}

          {params.warning && (
            <div
              role="alert"
              className="mt-5 rounded-[12px] bg-[#FFFAEB] p-4 text-[13px] font-bold text-[#92400E]"
            >
              {params.warning}
            </div>
          )}

          {params.error && (
            <div
              role="alert"
              className="mt-5 rounded-[12px] bg-[#FEF3F2] p-4 text-[13px] font-bold text-[#B42318]"
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
            className="mt-8 scroll-mt-8"
          >
            <h2 className="text-[23px] font-extrabold">
              Applications needing attention
            </h2>
            <p className="mt-2 text-[12px] text-[#667085]">
              Only pending and incomplete applications appear here.
            </p>

            {pending.length === 0 ? (
              <div className="mt-4 rounded-[15px] border border-dashed border-[#BAC7D7] bg-[#F8FAFC] p-6 text-center text-[13px]">
                ✓ Nothing needs review right now.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {pending.map((provider) => (
                  <a
                    key={provider.id}
                    href={`#provider-${provider.id}`}
                    className="rounded-[15px] border border-[#BAC7D7] bg-[#F8FAFC] p-4 hover:border-[#4771A6]"
                  >
                    <strong>{provider.business_name}</strong>
                    <p className="mt-1 text-[12px] text-[#667085]">
                      {provider.provider_type} · {provider.status}
                    </p>
                    <p className="mt-2 text-[12px] font-bold text-[#315C91]">
                      Open verification dossier
                    </p>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section
            id="businesses"
            className="mt-9 scroll-mt-8"
          >
            <h2 className="text-[23px] font-extrabold">
              Business applications & providers
            </h2>
            <p className="mt-2 text-[12px] text-[#667085]">
              Click + to expand a business and − to collapse it.
            </p>

            {(providerError || applicationError) && (
              <p role="alert" className="mt-3 text-[12px] text-[#B42318]">
                {providerError?.message || applicationError?.message}
              </p>
            )}

            <div className="mt-5 space-y-3">
              {orderedProviders.map((provider) => {
                const imageUrl = provider.image_path
                  ? supabase.storage
                      .from("garage-images")
                      .getPublicUrl(provider.image_path)
                      .data.publicUrl
                  : "";

                return (
                  <BusinessCard
                    key={provider.id}
                    provider={provider}
                    owner={accountMap.get(provider.owner_id)}
                    application={applicationMap.get(provider.id)}
                    services={services.filter(
                      (item) => item.provider_id === provider.id
                    )}
                    hours={hours.filter(
                      (item) => item.provider_id === provider.id
                    )}
                    imageUrl={imageUrl}
                  />
                );
              })}

              {orderedProviders.length === 0 && (
                <p className="rounded-[15px] bg-[#F8FAFC] p-6 text-center text-[13px]">
                  No provider accounts yet.
                </p>
              )}
            </div>
          </section>

          <section
            id="accounts"
            className="mt-9 scroll-mt-8"
          >
            <h2 className="text-[23px] font-extrabold">
              Registered accounts
            </h2>
            <p className="mt-2 text-[12px] text-[#667085]">
              Click + to view account information.
            </p>

            {accountsError && (
              <p role="alert" className="mt-3 text-[12px] text-[#B42318]">
                {accountsError.message}
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
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
