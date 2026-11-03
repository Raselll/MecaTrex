import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setProviderStatus } from "./actions";

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
  created_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  primary_phone: string;
};

function statusStyle(status: ProviderRow["status"]) {
  return {
    pending: "bg-[#FFF7E8] text-[#92400E]",
    approved: "bg-[#ECFDF3] text-[#027A48]",
    needs_information: "bg-[#EFF6FF] text-[#1D4ED8]",
    rejected: "bg-[#FEF3F2] text-[#B42318]",
  }[status];
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (profile?.account_type !== "admin") redirect("/account");

  const { data: providerRows, error: providerError } = await supabase
    .from("service_providers")
    .select("id, owner_id, provider_type, business_name, address_line1, city, province, postal_code, status, business_description, public_email, public_phone, is_listing_active, created_at")
    .order("created_at", { ascending: false });

  const providers = (providerRows ?? []) as ProviderRow[];
  const ownerIds = providers.map((provider) => provider.owner_id);
  let owners: ProfileRow[] = [];

  if (ownerIds.length > 0) {
    const { data: ownerRows } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, primary_phone")
      .in("id", ownerIds);
    owners = (ownerRows ?? []) as ProfileRow[];
  }

  const ownerMap = new Map(owners.map((owner) => [owner.id, owner]));
  const pendingCount = providers.filter((provider) => provider.status === "pending" || provider.status === "needs_information").length;

  return (
    <main className="min-h-screen bg-[#F5F7FA] px-5 py-10 text-[#101828]">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center">
            <Image src="/mecatrex-logo-web.png" alt="MECATREX" width={280} height={78} priority className="h-[58px] w-auto" />
          </Link>
          <Link href="/account" className="rounded-[14px] border border-[#D0D5DD] bg-white px-4 py-3 text-[14px] font-bold text-[#344054] hover:bg-[#F9FAFB]">
            Back to account
          </Link>
        </div>

        <div className="mt-8 rounded-[30px] border border-[#EAECF0] bg-white p-7 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">MECATREX administration</p>
              <h1 className="mt-2 text-[38px] font-bold tracking-[-0.04em] sm:text-[46px]">Provider applications</h1>
              <p className="mt-2 max-w-[760px] text-[15px] leading-6 text-[#667085]">
                Approve garages and towing companies, request additional information, or reject applications. Providers cannot approve themselves.
              </p>
            </div>
            <div className="rounded-[18px] bg-[#101828] px-5 py-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#83A7D3]">Needs review</p>
              <p className="mt-1 text-[28px] font-bold">{pendingCount}</p>
            </div>
          </div>

          {params.error && (
            <div className="mt-6 rounded-[15px] bg-[#FEF3F2] px-4 py-3 text-[14px] font-semibold text-[#B42318]">{params.error}</div>
          )}
          {params.success && (
            <div className="mt-6 rounded-[15px] bg-[#ECFDF3] px-4 py-3 text-[14px] font-semibold text-[#027A48]">{params.success}</div>
          )}
          {providerError && (
            <div className="mt-6 rounded-[15px] bg-[#FEF3F2] px-4 py-3 text-[14px] font-semibold text-[#B42318]">
              Could not load providers: {providerError.message}
            </div>
          )}

          <div className="mt-8 space-y-5">
            {providers.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[#D0D5DD] px-6 py-12 text-center text-[#667085]">No provider applications yet.</div>
            ) : (
              providers.map((provider) => {
                const owner = ownerMap.get(provider.owner_id);
                return (
                  <article key={provider.id} className="rounded-[24px] border border-[#EAECF0] p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[24px] font-bold tracking-[-0.02em]">{provider.business_name}</h2>
                          <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase ${statusStyle(provider.status)}`}>
                            {provider.status.replace("_", " ")}
                          </span>
                          <span className="rounded-full bg-[#F2F4F7] px-3 py-1.5 text-[11px] font-bold uppercase text-[#667085]">{provider.provider_type}</span>
                          {provider.is_listing_active && <span className="rounded-full bg-[#EDF3FA] px-3 py-1.5 text-[11px] font-bold text-[#315C91]">Published</span>}
                        </div>
                        <p className="mt-3 text-[14px] text-[#475467]">📍 {provider.address_line1}, {provider.city}, {provider.province} {provider.postal_code}</p>
                        {provider.business_description && <p className="mt-3 max-w-[760px] text-[14px] leading-6 text-[#667085]">{provider.business_description}</p>}
                        <div className="mt-4 grid gap-2 text-[13px] text-[#475467] sm:grid-cols-2">
                          <p><strong>Owner:</strong> {owner ? `${owner.first_name} ${owner.last_name}` : "Unknown"}</p>
                          <p><strong>Account email:</strong> {owner?.email ?? "—"}</p>
                          <p><strong>Account phone:</strong> {owner?.primary_phone ?? "—"}</p>
                          <p><strong>Public contact:</strong> {provider.public_phone || provider.public_email || "—"}</p>
                        </div>
                      </div>
                    </div>

                    <form action={setProviderStatus} className="mt-6 rounded-[18px] bg-[#F8FAFC] p-5">
                      <input type="hidden" name="provider_id" value={provider.id} />
                      <label className="block">
                        <span className="mb-2 block text-[12px] font-bold uppercase tracking-[0.1em] text-[#667085]">Message to provider (optional)</span>
                        <textarea
                          name="message"
                          rows={3}
                          placeholder="Explain what is missing or why the application was rejected."
                          className="w-full rounded-[14px] border border-[#D0D5DD] bg-white px-4 py-3 text-[14px] outline-none focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
                        />
                      </label>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button name="status" value="approved" className="rounded-[13px] bg-[#027A48] px-5 py-3 text-[13px] font-bold text-white hover:bg-[#05603A]">
                          ✓ Approve
                        </button>
                        <button name="status" value="needs_information" className="rounded-[13px] bg-[#4771A6] px-5 py-3 text-[13px] font-bold text-white hover:bg-[#3C6190]">
                          Request more information
                        </button>
                        <button name="status" value="rejected" className="rounded-[13px] border border-[#FDA29B] bg-white px-5 py-3 text-[13px] font-bold text-[#B42318] hover:bg-[#FEF3F2]">
                          Reject
                        </button>
                      </div>
                    </form>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
