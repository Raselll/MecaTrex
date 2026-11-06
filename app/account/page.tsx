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
import ClientBookings from "@/components/booking/client-bookings";
import ProviderCalendar from "@/components/booking/provider-calendar";
import BookingNotifications from "@/components/booking/booking-notifications";
import { ACCENT_COLORS, type AccentColor } from "@/lib/booking";

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

export default async function AccountPage({
  searchParams,
}: { searchParams: Promise<{ verified?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, account_type, first_name, last_name, email, primary_phone, secondary_phone, accent_color")
    .eq("id", user.id)
    .single<Profile>();

  if (profileError || !profile) {
    return (
      <AccountShell>
        <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-[#991B1B]">
          <h1 className="text-[24px] font-bold">Your account is authenticated, but the MECATREX database profile is not ready.</h1>
          <p className="mt-3 text-[14px] leading-6">
            Apply the latest Supabase migrations for this branch, then refresh this page. Your login session is still valid.
          </p>
        </div>
      </AccountShell>
    );
  }

  const displayName = `${profile.first_name} ${profile.last_name}`.trim() || profile.email;

  if (profile.account_type === "provider") {
    const providerSelect = "id, owner_id, provider_type, business_name, address_line1, city, province, postal_code, status, business_description, public_email, public_phone, website, image_path, latitude, longitude, is_listing_active, is_removed, provider_cancellation_count, booking_suspended";
    let { data: provider, error: providerError } = await supabase
      .from("service_providers")
      .select(providerSelect)
      .eq("owner_id", user.id)
      .maybeSingle<ProviderRecord>();

    // Existing accounts created before the provider trigger can be recovered.
    if (!provider && !providerError) {
      const recovery = await supabase.rpc("ensure_my_provider_record");
      if (recovery.error) console.error("Provider recovery RPC failed:", recovery.error.message);
      if (!recovery.error && recovery.data) {
        const reloaded = await supabase.from("service_providers")
          .select(providerSelect).eq("owner_id", user.id).maybeSingle<ProviderRecord>();
        provider = reloaded.data;
        providerError = reloaded.error;
      }
    }

    if (providerError || !provider) {
      return (
        <AccountShell>
          <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-[#991B1B]">
            <h1 className="text-[24px] font-bold">Your provider application needs to be synchronized.</h1>
            <p className="mt-3 text-[14px] leading-6">
              Your email is verified, but the business application could not be loaded. The MECATREX administrator must apply migration 20261110 after migrations 20261108 and 20261109. Your account has not been approved or published.
            </p>
            {providerError && <p className="mt-3 text-[12px]">Database error code: {providerError.code}</p>}
            <Link href="/account" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 font-bold text-[#991B1B]">Retry loading application</Link>
          </div>
        </AccountShell>
      );
    }

    const [{ data: providerServices }, { data: adminNote }] = await Promise.all([
      supabase
        .from("provider_services")
        .select("id, provider_id, name, description, price_cents, pricing_type, duration_minutes, is_active")
        .eq("provider_id", provider.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("provider_admin_notes")
        .select("message")
        .eq("provider_id", provider.id)
        .maybeSingle(),
    ]);

    return (
      <AccountShell wide>
        <div className="rounded-[30px] border border-[#EAECF0] border-t-[5px] bg-white p-7 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-9" style={{ borderTopColor: (ACCENT_COLORS[profile.accent_color] ?? ACCENT_COLORS.blue).hex }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">MECATREX business dashboard</p>
              <h1 className="mt-2 text-[32px] font-bold tracking-[-0.04em] text-[#101828] sm:text-[40px]">
                Welcome back, {profile.first_name}.
              </h1>
              <p className="mt-2 text-[15px] leading-6 text-[#667085]">
                {provider.status === "approved" && !provider.is_removed
                  ? "Manage your approved business, services and appointments."
                  : "Your application is under review. Services and prices unlock only after MECATREX approves your business."}
              </p>
            </div>
            <div className="rounded-[15px] bg-[#F2F4F7] px-4 py-3 text-[12px] font-bold text-[#475467]">
              {profile.email}
            </div>
          </div>

          {params.verified === "1" && provider.status !== "approved" && (
            <div role="status" className="mt-6 rounded-[18px] border border-[#B7D9C6] bg-[#F0FDF4] p-5">
              <h2 className="text-[20px] font-bold text-[#166534]">Email confirmed — application submitted</h2>
              <p className="mt-2 text-[14px] leading-6 text-[#475467]">
                Thank you for verifying your email. Our team will review your business registration
                and submitted services. We aim to respond within 24 hours by email. You can sign in
                anytime to check your application status. Services and prices remain locked until approval.
              </p>
            </div>
          )}
          <AccentPicker userId={user.id} initialAccent={profile.accent_color ?? "blue"} />
          <div className="mt-6 space-y-6">
            <BookingNotifications userId={user.id} />
            {provider.status === "approved" && !provider.is_removed && <ProviderCalendar providerId={provider.id} providerType={provider.provider_type}
              initialCancelled={provider.provider_cancellation_count ?? 0}
              initiallySuspended={Boolean(provider.booking_suspended)} />}
          </div>
          <ProviderDashboard
            userId={user.id}
            initialProvider={provider}
            initialServices={(providerServices ?? []) as ProviderService[]}
            adminMessage={adminNote?.message ?? null}
          />
        </div>
      </AccountShell>
    );
  }

  return (
    <AccountShell>
      <div className="rounded-[30px] border border-[#EAECF0] border-t-[5px] bg-white p-7 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-10" style={{ borderTopColor: (ACCENT_COLORS[profile.accent_color] ?? ACCENT_COLORS.blue).hex }}>
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">MECATREX account</p>
        <h1 className="mt-3 text-[36px] font-bold tracking-[-0.04em] text-[#101828] sm:text-[44px]">
          Welcome, {displayName}.
        </h1>
        <p className="mt-3 text-[16px] leading-7 text-[#667085]">
          Your email is confirmed and your MECATREX session is active.
        </p>

        <AccentPicker userId={user.id} initialAccent={profile.accent_color ?? "blue"} />

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <SummaryCard label="Email" value={profile.email} />
          <SummaryCard label="Account type" value={profile.account_type === "admin" ? "Administrator" : "Client"} />
          <SummaryCard label="Primary phone" value={profile.primary_phone} />
          <SummaryCard label="Secondary phone" value={profile.secondary_phone || "Not provided"} />
        </div>

        {profile.account_type === "admin" ? (
          <div className="mt-7 rounded-[20px] bg-[#101828] p-6 text-white">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#83A7D3]">Administrator</p>
            <h2 className="mt-2 text-[24px] font-bold">Provider approvals are ready.</h2>
            <p className="mt-2 text-[14px] leading-6 text-white/70">
              Review garage and towing applications, request additional information, approve providers, or reject applications.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/admin?view=review#applications" className="inline-flex rounded-[13px] bg-white px-5 py-3 text-[14px] font-bold text-[#101828] hover:bg-[#EDF3FA]">
                Review applications →
              </Link>
              <Link href="/admin?view=accounts#accounts" className="inline-flex rounded-[13px] border border-white/40 px-5 py-3 text-[14px] font-bold text-white hover:bg-white/10">
                View all accounts →
              </Link>
            </div>
          </div>
        ) : (
          <>
          <div className="mt-7 space-y-6">
            <BookingNotifications userId={user.id} />
            <ClientBookings userId={user.id} />
          </div>
          <div className="mt-7 rounded-[22px] border border-[#D5DFEA] bg-[#EDF3FA] p-6">
            <h2 className="text-[22px] font-bold text-[#101828]">Ready to find a garage?</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#475467]">Browse approved businesses, compare their fixed service prices and contact your preferred garage. Online booking is coming next.</p>
            <Link href="/#garage-results" className="mt-5 inline-flex rounded-[13px] bg-[#4771A6] px-6 py-3.5 text-[14px] font-bold text-white hover:bg-[#315C91]">
              Find garages →
            </Link>
          </div>
          </>
        )}
      </div>
    </AccountShell>
  );
}

function AccountShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-[#F5F7FA] px-5 py-10">
      <div className={`mx-auto ${wide ? "max-w-[1280px]" : "max-w-[820px]"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center">
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
            <Link href="/" className="rounded-[14px] border border-[#D0D5DD] bg-white px-4 py-3 text-[14px] font-bold text-[#344054] hover:bg-[#F9FAFB]">Browse garages</Link>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#EAECF0] bg-[#F9FAFB] p-5">
      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">{label}</p>
      <p className="mt-2 break-all text-[16px] font-semibold text-[#101828]">{value}</p>
    </div>
  );
}
