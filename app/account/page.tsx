
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProviderDashboard, {
  type ProviderRecord,
  type ProviderService,
} from "./provider-dashboard";
import { signOut } from "./actions";
import AccentPicker from "@/components/account/accent-picker";
import ClientPortalOverview from "@/components/account/client-portal-overview";
import AccountWorkspace from "@/components/account/account-workspace";
import ClientBookings from "@/components/booking/client-bookings";
import FinancialOverview from "@/components/account/financial-overview";
import ProviderCalendar from "@/components/booking/provider-calendar";
import {
  ACCENT_COLORS,
  type AccentColor,
} from "@/lib/booking";
import { isCompleteService } from "@/lib/service-listing";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  account_type: "client" | "provider" | "admin";
  first_name: string;
  last_name: string;
  email: string;
  primary_phone: string;
  secondary_phone: string | null;
  accent_color: AccentColor;
};

type ChecklistItem = {
  title: string;
  description: string;
  complete: boolean;
  href: string;
};

/* ========================================================= */
/* PROVIDER READINESS CHECKLIST */
/* ========================================================= */

function ProviderReadiness({
  provider,
  services,
}: {
  provider: ProviderRecord;
  services: ProviderService[];
}) {
  if (provider.is_removed) return null;

  const activeServices = services.filter(
    (service) =>
      service.is_active &&
      isCompleteService(
        service.name,
        service.pricing_type,
        service.price_cents,
        service.duration_minutes
      )
  );

  const items: ChecklistItem[] = [
    {
      title: "Business details",
      description: "Complete your public business profile.",
      complete: Boolean(
        provider.business_name?.trim() &&
          provider.address_line1?.trim() &&
          provider.postal_code?.trim() &&
          provider.public_phone?.trim() &&
          provider.public_email?.trim()
      ),
      href: "#business-profile",
    },
    {
      title: "Business photo",
      description: "Upload a photo customers can recognize.",
      complete: Boolean(provider.image_path),
      href: "#business-profile",
    },
    {
      title: "Services & fixed prices",
      description: "List at least one bookable service.",
      complete: activeServices.length > 0,
      href: "#services",
    },
    {
      title: "MECATREX approval",
      description: "Complete the provider review process.",
      complete:
        provider.status === "approved" &&
        !provider.is_removed,
      href: "#application-status",
    },
  ];

  const completed = items.filter(
    (item) => item.complete
  ).length;

  // Hide the checklist when all steps are complete.
  if (completed === items.length) {
    return null;
  }

  const percentage = Math.round(
    (completed / items.length) * 100
  );

  return (
    <section
      aria-label="Business listing checklist"
      className="mt-6 rounded-[22px] border border-[#C8D8EA] bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">
            Get your business ready
          </p>

          <h2 className="mt-2 text-[21px] font-extrabold tracking-tight text-[#101828]">
            Your listing checklist
          </h2>

          <p className="mt-1 text-[13px] text-[#667085]">
            Finish these steps to prepare your listing.
          </p>
        </div>

        <span className="rounded-full bg-[#EDF3FA] px-4 py-2 text-[12px] font-bold text-[#315C91]">
          {completed} / {items.length} complete
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-label="Listing completion"
        className="mt-5 h-[8px] overflow-hidden rounded-full bg-[#E9EEF5]"
      >
        <div
          className="h-full rounded-full bg-[#4771A6] transition-all duration-500"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <a
            key={item.title}
            href={item.href}
            className={`flex items-start gap-3 rounded-[15px] border p-4 transition ${
              item.complete
                ? "border-[#D1FADF] bg-[#F0FDF4]"
                : "border-[#D6E0ED] bg-[#F8FAFC] hover:border-[#4771A6] hover:bg-[#EDF3FA]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold ${
                item.complete
                  ? "bg-[#D1FADF] text-[#027A48]"
                  : "bg-[#E4EAF3] text-[#4771A6]"
              }`}
            >
              {item.complete ? "✓" : "○"}
            </span>

            <div>
              <p className="text-[13px] font-extrabold text-[#101828]">
                {item.title}
              </p>

              <p className="mt-1 text-[11px] leading-5 text-[#667085]">
                {item.complete
                  ? "Completed"
                  : item.description}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ========================================================= */
/* MAIN ACCOUNT PAGE */
/* ========================================================= */

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      "id, account_type, first_name, last_name, email, primary_phone, secondary_phone, accent_color"
    )
    .eq("id", user.id)
    .single<Profile>();

  if (profileError || !profile) {
    return (
      <AccountShell>
        <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-[#991B1B]">
          <h1 className="text-[24px] font-bold">
            Your MECATREX database profile is not ready.
          </h1>

          <p className="mt-3 text-[14px] leading-6">
            Apply the latest Supabase migrations, then
            refresh this page. Your login session is
            still valid.
          </p>
        </div>
      </AccountShell>
    );
  }

  if (profile.account_type === "admin") {
    redirect("/admin");
  }

  /* ======================================================= */
  /* SERVICE PROVIDER ACCOUNT */
  /* ======================================================= */

  if (profile.account_type === "provider") {
    const providerSelect =
      "id, owner_id, provider_type, business_name, address_line1, city, province, postal_code, status, business_description, public_email, public_phone, website, image_path, latitude, longitude, is_listing_active, is_removed, provider_cancellation_count, booking_suspended";

    let {
      data: provider,
      error: providerError,
    } = await supabase
      .from("service_providers")
      .select(providerSelect)
      .eq("owner_id", user.id)
      .maybeSingle<ProviderRecord>();

    /* ===================================================== */
    /* PROVIDER RECORD RECOVERY */
    /* ===================================================== */

    if (!provider && !providerError) {
      const recovery = await supabase.rpc(
        "ensure_my_provider_record"
      );

      if (recovery.error) {
        console.error(
          "Provider recovery failed:",
          recovery.error.message
        );
      }

      if (!recovery.error && recovery.data) {
        const reloaded = await supabase
          .from("service_providers")
          .select(providerSelect)
          .eq("owner_id", user.id)
          .maybeSingle<ProviderRecord>();

        provider = reloaded.data;
        providerError = reloaded.error;
      }
    }

    if (providerError || !provider) {
      return (
        <AccountShell>
          <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-[#991B1B]">
            <h1 className="text-[24px] font-bold">
              Your provider application needs to be
              synchronized.
            </h1>

            <p className="mt-3 text-[14px] leading-6">
              Your account is authenticated, but your
              business application could not be loaded.
              Apply the required MECATREX database
              migrations or contact the administrator.
            </p>

            {providerError && (
              <p className="mt-3 text-[12px]">
                Database error: {providerError.code}
              </p>
            )}

            <Link
              href="/account"
              className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 font-bold"
            >
              Retry loading application
            </Link>
          </div>
        </AccountShell>
      );
    }

    /* ===================================================== */
    /* SERVICE & ADMIN DATA */
    /* ===================================================== */

    const [
      { data: providerServices },
      { data: adminNote },
    ] = await Promise.all([
      supabase
        .from("provider_services")
        .select(
          "id, provider_id, name, description, price_cents, pricing_type, duration_minutes, is_active"
        )
        .eq("provider_id", provider.id)
        .order("created_at", {
          ascending: true,
        }),

      supabase
        .from("provider_admin_notes")
        .select("message")
        .eq("provider_id", provider.id)
        .maybeSingle(),
    ]);

    const services =
      (providerServices ?? []) as ProviderService[];

    const approved =
      provider.status === "approved" &&
      !provider.is_removed;

    const accent =
      profile.accent_color ?? "blue";

    return (
      <AccountShell wide accent={accent}>
        <main
          className="portal-main-card rounded-[30px] border border-[#EAECF0] border-t-[5px] bg-white p-5 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-9"
          style={{
            borderTopColor:
              (ACCENT_COLORS[accent] ??
                ACCENT_COLORS.blue).hex,
          }}
        >
          {/* ================================================ */}
          {/* ACCOUNT HEADER + COMPACT THEME PALETTE */}
          {/* ================================================ */}

          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="portal-kicker text-[12px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">
                MECATREX Business Dashboard
              </p>

              <h1 className="mt-2 text-[31px] font-bold tracking-[-0.04em] text-[#101828] sm:text-[39px]">
                Welcome back, {profile.first_name}.
              </h1>

              <p className="mt-2 text-[14px] leading-6 text-[#667085]">
                {approved
                  ? "Manage your business, calendar, services and appointments in one place."
                  : "Track your provider application and MECATREX review."}
              </p>
            </div>

          </header>

          {/* ================================================ */}
          {/* EMAIL VERIFICATION CONFIRMATION */}
          {/* ================================================ */}

          {params.verified === "1" && !approved && (
            <div
              role="status"
              className="mt-6 rounded-[18px] border border-[#B7D9C6] bg-[#F0FDF4] p-5"
            >
              <h2 className="text-[20px] font-bold text-[#166534]">
                Email confirmed — application submitted
              </h2>

              <p className="mt-2 text-[14px] leading-6 text-[#475467]">
                Your email has been verified.
                MECATREX will review your business
                registration and submitted services.
                We aim to respond within 24 hours
                by email. Pricing and publication
                remain locked until approval.
              </p>
            </div>
          )}

          <AccountWorkspace
            kind="provider"
            userId={user.id}
            firstName={profile.first_name}
            approved={approved}
            overview={
              <ProviderReadiness provider={provider} services={services} />
            }
            financials={approved ? <FinancialOverview ownerId={provider.id} kind="provider" /> : undefined}
            calendar={
              approved ? (
                <ProviderCalendar
                  providerId={provider.id}
                  providerType={provider.provider_type}
                  initialCancelled={provider.provider_cancellation_count ?? 0}
                  initiallySuspended={Boolean(provider.booking_suspended)}
                />
              ) : undefined
            }
            providerDashboard={
              <div className="provider-dashboard-compact">
                <ProviderDashboard
                  userId={user.id}
                  initialProvider={provider}
                  initialServices={services}
                  adminMessage={adminNote?.message ?? null}
                />
              </div>
            }
            settings={
              <div className="space-y-5">
                <section className="rounded-[20px] border border-[#D5DFEA] bg-white p-5 sm:p-6">
                  <h3 className="text-[18px] font-extrabold text-[#101828]">Dashboard appearance</h3>
                  <p className="mt-1 text-[12px] text-[#667085]">Choose your workspace colour.</p>
                  <div className="mt-4">
                    <AccentPicker userId={user.id} initialAccent={accent} compact />
                  </div>
                </section>
                <section className="rounded-[20px] border border-[#D5DFEA] bg-white p-5 sm:p-6">
                  <h3 className="text-[18px] font-extrabold text-[#101828]">Account information</h3>
                  <p className="mt-1 text-[12px] text-[#667085]">
                    These account details are separate from your public business listing.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <SummaryCard label="Account email" value={profile.email} />
                    <SummaryCard label="Account type" value="Service provider" />
                    <SummaryCard label="Primary phone" value={profile.primary_phone} />
                    <SummaryCard label="Secondary phone" value={profile.secondary_phone || "Not provided"} />
                  </div>
                </section>
              </div>
            }
          />

          <style>{`
            .provider-dashboard-compact > div > nav[aria-label="Business dashboard shortcuts"] {
              display: none !important;
            }
            .provider-dashboard-compact > div > nav[aria-label="Business dashboard shortcuts"] + div {
              display: none !important;
            }
          `}</style>
        </main>
      </AccountShell>
    );
  }

  /* ======================================================= */
  /* CLIENT ACCOUNT */
  /* ======================================================= */

  const accent = profile.accent_color ?? "blue";

  const clientProps = {
    userId: user.id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    primaryPhone: profile.primary_phone,
    secondaryPhone: profile.secondary_phone,
  };

  return (
    <AccountShell wide accent={accent}>
      <div
        className="portal-main-card rounded-[30px] border border-[#EAECF0] border-t-[5px] bg-white p-4 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-7"
        style={{ borderTopColor: (ACCENT_COLORS[accent] ?? ACCENT_COLORS.blue).hex }}
      >
        <div className="px-1 pt-2 sm:px-2">
          <p className="portal-kicker text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">
            MECATREX client account
          </p>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-[#101828] sm:text-[36px]">
            Welcome back, {profile.first_name}.
          </h1>
          <p className="mt-1 text-[13px] text-[#667085]">
            Find the right garage and manage your appointments without the clutter.
          </p>
        </div>

        <AccountWorkspace
          kind="client"
          userId={user.id}
          firstName={profile.first_name}
          overview={<ClientPortalOverview {...clientProps} mode="overview" />}
          appointments={<ClientBookings userId={user.id} />}
          financials={<FinancialOverview ownerId={user.id} kind="client" />}
          settings={
            <div className="space-y-5">
              <section className="rounded-[20px] border border-[#D5DFEA] bg-white p-5 sm:p-6">
                <h3 className="text-[18px] font-extrabold text-[#101828]">Dashboard appearance</h3>
                <p className="mt-1 text-[12px] text-[#667085]">Choose your dashboard colour.</p>
                <div className="mt-4">
                  <AccentPicker userId={user.id} initialAccent={accent} compact />
                </div>
              </section>

              <ClientPortalOverview {...clientProps} mode="settings" />

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryCard label="Email" value={profile.email} />
                <SummaryCard label="Account type" value="Client" />
              </div>
            </div>
          }
        />
      </div>
    </AccountShell>
  );
}

/* ========================================================= */
/* ACCOUNT SHELL */
/* ========================================================= */

function AccountShell({
  children,
  wide = false,
  accent = "blue",
}: {
  children: React.ReactNode;
  wide?: boolean;
  accent?: AccentColor;
}) {
  return (
    <main
      className="portal-theme min-h-screen px-5 py-10"
      data-portal-theme={accent}
    >
      <div
        className={`mx-auto ${
          wide
            ? "max-w-[1280px]"
            : "max-w-[820px]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center"
          >
            <Image
              src="/mecatrex-logo-web.png"
              alt="MECATREX"
              width={280}
              height={78}
              priority
              className="h-[58px] w-auto"
            />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-[14px] border border-[#D0D5DD] bg-white px-4 py-3 text-[14px] font-bold text-[#344054] hover:bg-[#F9FAFB]"
            >
              Browse garages
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                className="rounded-[14px] border border-[#D0D5DD] bg-white px-4 py-3 text-[14px] font-bold text-[#344054] transition hover:bg-[#F9FAFB]"
              >
                Log out
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

/* ========================================================= */
/* CLIENT SUMMARY CARD */
/* ========================================================= */

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="portal-summary-card rounded-[18px] border border-[#EAECF0] bg-[#F9FAFB] p-5">
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">
        {label}
      </p>

      <p className="mt-2 break-all text-[16px] font-semibold text-[#101828]">
        {value}
      </p>
    </div>
  );
}
