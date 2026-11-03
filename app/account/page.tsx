import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const firstName = String(user.user_metadata?.first_name ?? "").trim();
  const lastName = String(user.user_metadata?.last_name ?? "").trim();
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || user.email || "MECATREX user";
  const accountType = String(user.user_metadata?.account_type ?? "client");

  return (
    <main className="min-h-screen bg-[#F5F7FA] px-5 py-10">
      <div className="mx-auto max-w-[820px]">
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

        <div className="mt-8 rounded-[30px] border border-[#EAECF0] bg-white p-7 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-10">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">MECATREX account</p>
          <h1 className="mt-3 text-[36px] font-bold tracking-[-0.04em] text-[#101828] sm:text-[44px]">
            Welcome, {displayName}.
          </h1>
          <p className="mt-3 text-[16px] leading-7 text-[#667085]">
            Your email is confirmed and your MECATREX session is active.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[18px] border border-[#EAECF0] bg-[#F9FAFB] p-5">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">Email</p>
              <p className="mt-2 break-all text-[16px] font-semibold text-[#101828]">{user.email}</p>
            </div>
            <div className="rounded-[18px] border border-[#EAECF0] bg-[#F9FAFB] p-5">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">Account type</p>
              <p className="mt-2 text-[16px] font-semibold capitalize text-[#101828]">{accountType}</p>
            </div>
          </div>

          <div className="mt-7 rounded-[18px] bg-[#EDF3FA] p-5 text-[14px] leading-6 text-[#475467]">
            The full client/provider account dashboard will be built on top of this authenticated page. For now, this confirms that signup, email verification, session creation, login, and logout are connected correctly.
          </div>
        </div>
      </div>
    </main>
  );
}
