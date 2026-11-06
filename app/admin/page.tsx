import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resendProviderDecisionEmail, setProviderStatus } from "./actions";

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
  account_type: "client" | "provider" | "admin";
  created_at: string;
};

function statusStyle(status: ProviderRow["status"]) {
  return {
    pending: "bg-[#FFF7E8] text-[#92400E]",
    approved: "bg-[#ECFDF3] text-[#027A48]",
    needs_information: "bg-[#EFF6FF] text-[#1D4ED8]",
    rejected: "bg-[#FEF3F2] text-[#B42318]",
  }[status];
}

function PhoneLink({ number }: { number: string | null | undefined }) {
  if (!number) return <span className="text-[#98A2B3]">Not provided</span>;
  return <a href={`tel:${number.replace(/[^\d+]/g, "")}`} className="font-semibold text-[#315C91] underline underline-offset-2 hover:text-[#101828]">{number}</a>;
}

function EmailLink({ email }: { email: string | null | undefined }) {
  if (!email) return <span className="text-[#98A2B3]">Not provided</span>;
  return <a href={`mailto:${email}`} className="break-all font-semibold text-[#315C91] underline underline-offset-2 hover:text-[#101828]">{email}</a>;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; warning?: string; view?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "review" || params.view === "accounts" ? params.view : "all";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .single();
  if (currentProfile?.account_type !== "admin") redirect("/account");

  const [{ data: providerRows, error: providerError }, { data: profileRows, error: accountsError }] = await Promise.all([
    supabase
      .from("service_providers")
      .select("id, owner_id, provider_type, business_name, address_line1, city, province, postal_code, status, business_description, public_email, public_phone, is_listing_active, booking_suspended, provider_cancellation_count, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email, primary_phone, account_type, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const providers = (providerRows ?? []) as ProviderRow[];
  const accounts = (profileRows ?? []) as ProfileRow[];
  const ownerMap = new Map(accounts.map((owner) => [owner.id, owner]));
  const providerMap = new Map(providers.map((provider) => [provider.owner_id, provider]));
  const pending = providers.filter((provider) => provider.status === "pending" || provider.status === "needs_information");
  const filtered = view === "review" ? pending : providers;
  const clientsCount = accounts.filter((account) => account.account_type === "client").length;
  const businessCount = accounts.filter((account) => account.account_type === "provider").length;
  const brevoConfigured = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL && process.env.MECATREX_ADMIN_EMAIL);

  return (
    <main className="min-h-screen bg-[#F5F7FA] px-4 py-8 text-[#101828] sm:px-6">
      <div className="mx-auto max-w-[1250px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" aria-label="MECATREX homepage">
            <Image src="/mecatrex-logo-web.png" alt="MECATREX" width={260} height={74} priority className="h-[52px] w-auto" />
          </Link>
          <Link href="/account" className="rounded-xl border border-[#BAC7D7] bg-white px-5 py-3 text-[14px] font-bold text-[#344054] hover:bg-[#EDF3FA]">← Back to account</Link>
        </header>

        <div className="mt-7 rounded-[28px] border border-[#E4E7EC] bg-white p-6 shadow-[0_16px_50px_rgba(16,24,40,0.06)] sm:p-9">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">MECATREX administration</p>
          <h1 className="mt-2 text-[34px] font-bold tracking-[-0.04em] sm:text-[44px]">Manage your marketplace</h1>
          <p className="mt-2 text-[15px] text-[#667085]">Review applications, contact businesses and see exactly who has signed up.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Link href="/admin?view=review#applications" className="rounded-[18px] border border-[#BAC7D7] bg-[#101828] p-5 text-white transition hover:bg-[#315C91]">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#B9D4F2]">Needs review · open list ↗</p>
              <p className="mt-1 text-[31px] font-extrabold">{pending.length}</p>
            </Link>
            <Link href="/admin?view=all#applications" className="rounded-[18px] border border-[#BAC7D7] bg-[#F8FAFC] p-5 transition hover:bg-[#EDF3FA]">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#667085]">Businesses · open list ↗</p>
              <p className="mt-1 text-[31px] font-extrabold">{businessCount}</p>
            </Link>
            <Link href="/admin?view=accounts#accounts" className="rounded-[18px] border border-[#BAC7D7] bg-[#F8FAFC] p-5 transition hover:bg-[#EDF3FA]">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#667085]">Client accounts · open list ↗</p>
              <p className="mt-1 text-[31px] font-extrabold">{clientsCount}</p>
            </Link>
          </div>

          {!brevoConfigured && (
            <div role="alert" className="mt-5 rounded-[16px] border border-[#FEC84B] bg-[#FFFAEB] p-4 text-[14px] leading-6 text-[#92400E]">
              <strong>Action required: notification emails are not configured.</strong> Add BREVO_API_KEY, BREVO_SENDER_EMAIL, and MECATREX_ADMIN_EMAIL to the MECATREX server environment, then restart your development server. The SMTP key inside Supabase alone does not configure custom admin/provider messages.
            </div>
          )}
          {params.success && <div role="status" className="mt-5 rounded-[14px] bg-[#ECFDF3] p-4 text-[14px] font-semibold text-[#027A48]">{params.success}</div>}
          {params.warning && <div role="alert" className="mt-5 rounded-[14px] bg-[#FFFAEB] p-4 text-[14px] font-semibold text-[#92400E]">{params.warning}</div>}
          {params.error && <div role="alert" className="mt-5 rounded-[14px] bg-[#FEF3F2] p-4 text-[14px] font-semibold text-[#B42318]">{params.error}</div>}

          <nav aria-label="Admin sections" className="mt-7 flex flex-wrap gap-2 border-b border-[#E4E7EC] pb-4">
            {[
              { key: "review", label: `Needs review (${pending.length})`, target: "#applications" },
              { key: "all", label: `All businesses (${providers.length})`, target: "#applications" },
              { key: "accounts", label: `Accounts (${accounts.length})`, target: "#accounts" },
            ].map((tab) => (
              <Link key={tab.key} href={`/admin?view=${tab.key}${tab.target}`} aria-current={view === tab.key ? "page" : undefined}
                className={`rounded-[12px] px-5 py-3 text-[14px] font-bold transition ${view === tab.key ? "bg-[#101828] text-white" : "border border-[#D0D5DD] text-[#344054] hover:bg-[#EDF3FA]"}`}>
                {tab.label}
              </Link>
            ))}
          </nav>

          {view === "accounts" ? (
            <section id="accounts" className="scroll-mt-8 pt-6">
              <h2 className="text-[24px] font-bold">Registered accounts</h2>
              <p className="mt-2 text-[14px] text-[#667085]">These roles come from the secured <code>public.profiles.account_type</code> field, not the Supabase Authentication sign-in provider column.</p>
              {accountsError && <p role="alert" className="mt-4 text-[#B42318]">Could not load accounts: {accountsError.message}</p>}
              <div className="mt-5 overflow-x-auto rounded-[18px] border border-[#BAC7D7]">
                <table className="w-full min-w-[730px] text-left text-[13px]">
                  <thead className="bg-[#F2F4F7] font-bold text-[#344054]">
                    <tr><th className="p-4">Name / account</th><th className="p-4">Type</th><th className="p-4">Business</th><th className="p-4">Phone</th><th className="p-4">Joined</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7EC]">
                    {accounts.map((account) => {
                      const provider = providerMap.get(account.id);
                      return (
                        <tr key={account.id} className="hover:bg-[#F8FAFC]">
                          <td className="p-4"><p className="font-bold">{account.first_name} {account.last_name}</p><EmailLink email={account.email} /></td>
                          <td className="p-4"><span className="rounded-full bg-[#EDF3FA] px-3 py-1.5 font-bold uppercase text-[#315C91]">{account.account_type === "provider" ? "Business" : account.account_type}</span></td>
                          <td className="p-4">{provider ? <><p className="font-semibold">{provider.business_name}</p><p className="mt-1 capitalize text-[#667085]">{provider.provider_type} · {provider.status.replaceAll("_", " ")}</p></> : "—"}</td>
                          <td className="p-4"><PhoneLink number={account.primary_phone} /></td>
                          <td className="p-4 text-[#667085]">{new Date(account.created_at).toLocaleDateString("en-CA")}</td>
                        </tr>
                      );
                    })}
                    {accounts.length === 0 && !accountsError && <tr><td colSpan={5} className="p-8 text-center text-[#667085]">No accounts found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section id="applications" className="scroll-mt-8 pt-6">
              <h2 className="text-[24px] font-bold">{view === "review" ? "Applications needing attention" : "All service providers"}</h2>
              <p className="mt-2 text-[14px] text-[#667085]">{view === "review" ? "Only pending applications and those awaiting information are shown here." : "View approved, pending and rejected businesses."}</p>
              {providerError && <p role="alert" className="mt-4 text-[#B42318]">Could not load providers: {providerError.message}</p>}
              <div className="mt-5 space-y-5">
                {filtered.length === 0 && !providerError && (
                  <div className="rounded-[20px] border border-dashed border-[#BAC7D7] bg-[#F8FAFC] p-8 text-center">
                    <p className="text-[24px]" aria-hidden="true">✓</p>
                    <p className="mt-2 text-[17px] font-bold">{view === "review" ? "Nothing needs review right now." : "No provider accounts yet."}</p>
                    {view === "review" && <Link href="/admin?view=all#applications" className="mt-3 inline-block font-bold text-[#4771A6] underline">View all businesses</Link>}
                  </div>
                )}
                {filtered.map((provider) => {
                  const owner = ownerMap.get(provider.owner_id);
                  return (
                    <article key={provider.id} className="rounded-[22px] border border-[#BAC7D7] bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="mr-1 text-[22px] font-extrabold">{provider.business_name}</h3>
                        <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase ${statusStyle(provider.status)}`}>{provider.status.replaceAll("_", " ")}</span>
                        <span className="rounded-full bg-[#EDF3FA] px-3 py-1.5 text-[11px] font-bold uppercase text-[#315C91]">{provider.provider_type}</span>
                        {provider.is_listing_active && <span className="rounded-full bg-[#ECFDF3] px-3 py-1.5 text-[11px] font-bold text-[#027A48]">Published</span>}
                        {provider.booking_suspended && <span className="rounded-full bg-[#FEF3F2] px-3 py-1.5 text-[11px] font-bold text-[#B42318]">⛔ Booking suspended · 3 cancellations</span>}
                      </div>
                      <p className="mt-3 text-[14px] leading-6 text-[#475467]">📍 {provider.address_line1}, {provider.city}, {provider.province} {provider.postal_code}</p>
                      {provider.business_description && <p className="mt-2 text-[14px] text-[#667085]">{provider.business_description}</p>}
                      <div className="mt-4 grid gap-3 rounded-[15px] bg-[#F8FAFC] p-4 text-[13px] sm:grid-cols-2">
                        <p><strong>Owner:</strong> {owner ? `${owner.first_name} ${owner.last_name}` : "Not found"}</p>
                        <p><strong>Account email:</strong> <EmailLink email={owner?.email} /></p>
                        <p><strong>Account phone:</strong> <PhoneLink number={owner?.primary_phone} /></p>
                        <p><strong>Public phone:</strong> <PhoneLink number={provider.public_phone} /></p>
                        <p><strong>Public email:</strong> <EmailLink email={provider.public_email} /></p>
                        <p><strong>Submitted:</strong> {new Date(provider.created_at).toLocaleDateString("en-CA")}</p>
                        {provider.provider_type === "garage" && <p><strong>Garage cancellations:</strong> {provider.provider_cancellation_count} / 3 {provider.booking_suspended ? "· Account booking suspended" : ""}</p>}
                      </div>
                      <form action={setProviderStatus} className="mt-5 rounded-[16px] border border-[#D0D5DD] bg-[#F8FAFC] p-4">
                        <input type="hidden" name="provider_id" value={provider.id} />
                        <label className="block">
                          <span className="mb-2 block text-[13px] font-bold text-[#101828]">Message to provider (required for rejection or more information)</span>
                          <textarea name="message" rows={3} placeholder="Clearly explain what you need, or why you declined the application..." className="w-full rounded-[13px] border border-[#98A2B3] bg-white px-4 py-3 text-[14px] outline-none focus:border-[#4771A6]" />
                        </label>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="submit" name="status" value="approved" disabled={provider.status === "approved"} className="rounded-[12px] bg-[#027A48] px-4 py-3 text-[13px] font-bold text-white hover:bg-[#05603A] disabled:cursor-not-allowed disabled:opacity-40">✓ Approve</button>
                          <button type="submit" name="status" value="needs_information" className="rounded-[12px] bg-[#4771A6] px-4 py-3 text-[13px] font-bold text-white hover:bg-[#315C91]">Request more info</button>
                          <button type="submit" name="status" value="rejected" disabled={provider.status === "rejected"} className="rounded-[12px] border border-[#FDA29B] bg-white px-4 py-3 text-[13px] font-bold text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-40">Reject</button>
                        </div>
                      </form>
                      {provider.status !== "pending" && (
                        <form action={resendProviderDecisionEmail} className="mt-3 flex flex-wrap items-center gap-3">
                          <input type="hidden" name="provider_id" value={provider.id} />
                          <button type="submit" className="rounded-[12px] border border-[#98A2B3] bg-white px-4 py-2.5 text-[13px] font-bold text-[#315C91] hover:bg-[#EDF3FA]">↻ Resend decision email</button>
                          <span className="text-[12px] text-[#667085]">Sends the current decision and saved message to the account email.</span>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
