import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProviderDashboard, {
  type ProviderRecord,
  type ProviderService,
} from "./provider-dashboard";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  account_type: "client" | "provider" | "admin";
  first_name: string;
  last_name: string;
  email: string;
  primary_phone: string;
  secondary_phone: string | null;
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, account_type, first_name, last_name, email, primary_phone, secondary_phone")
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
    const { data: provider, error: providerError } = await supabase
      .from("service_providers")
      .select(
        "id, owner_id, provider_type, business_name, address_line1, city, province, postal_code, status, business_description, public_email, public_phone, website, image_path, latitude, longitude, is_listing_active"
      )
      .eq("owner_id", user.id)
      .single<ProviderRecord>();

    if (providerError || !provider) {
      return (
        <AccountShell>
          <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-[#991B1B]">
            <h1 className="text-[24px] font-bold">Provider profile not found.</h1>
            <p className="mt-3 text-[14px] leading-6">
              Your account is marked as a service provider, but its provider record could not be loaded. Apply the latest database migration or contact the MECATREX administrator.
            </p>
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
        <div className="rounded-[30px] border border-[#EAECF0] bg-white p-7 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-9">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">Provider dashboard</p>
              <h1 className="mt-2 text-[36px] font-bold tracking-[-0.04em] text-[#101828] sm:text-[44px]">
                Welcome, {displayName}.
              </h1>
              <p className="mt-2 text-[15px] leading-6 text-[#667085]">
                Manage what customers see on MECATREX. Scheduling and live availability will be connected in the next phase.
              </p>
            </div>
            <div className="rounded-[15px] bg-[#F2F4F7] px-4 py-3 text-[12px] font-bold text-[#475467]">
              {profile.email}
            </div>
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
      <div className="rounded-[30px] border border-[#EAECF0] bg-white p-7 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-10">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">MECATREX account</p>
        <h1 className="mt-3 text-[36px] font-bold tracking-[-0.04em] text-[#101828] sm:text-[44px]">
          Welcome, {displayName}.
        </h1>
        <p className="mt-3 text-[16px] leading-7 text-[#667085]">
          Your email is confirmed and your MECATREX session is active.
        </p>

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
            <Link href="/admin" className="mt-5 inline-flex rounded-[13px] bg-white px-5 py-3 text-[13px] font-bold text-[#101828] hover:bg-[#EDF3FA]">
              Open admin dashboard →
            </Link>
          </div>
        ) : (
          <div className="mt-7 rounded-[18px] bg-[#EDF3FA] p-5 text-[14px] leading-6 text-[#475467]">
            Your client dashboard will become the home for upcoming bookings, vehicles, messages, and service history as those features are connected.
          </div>
        )}
      </div>
    </AccountShell>
  );
}

function AccountShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen bg-[#F5F7FA] px-5 py-10">
      <div className={`mx-auto ${wide ? "max-w-[1280px]" : "max-w-[820px]"}`}>
        <div className="flex items-center justify-between gap-4">
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

          <form action={signOut}>
            <button
              type="submit"
              className="rounded-[14px] border border-[#D0D5DD] bg-white px-4 py-3 text-[14px] font-bold text-[#344054] transition hover:bg-[#F9FAFB]"
            >
              Log out
            </button>
          </form>
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
