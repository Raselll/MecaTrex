import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ResetPasswordForm from "./reset-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=" + encodeURIComponent("Open the link in your password reset email, or request a new one."));

  const { error } = await searchParams;
  return (
    <main className="min-h-screen bg-[#F5F7FA] px-5 py-10 text-[#101828]">
      <div className="mx-auto max-w-[620px]">
        <Link href="/" aria-label="Back to MECATREX">
          <Image src="/mecatrex-logo-web.png" alt="MECATREX" width={280} height={78} priority className="h-[58px] w-auto" />
        </Link>
        <div className="mt-8 rounded-[30px] border border-[#EAECF0] bg-white p-7 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-10">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">Secure account recovery</p>
          <h1 className="mt-3 text-[38px] font-bold tracking-[-0.04em]">Choose a new password.</h1>
          <p className="mt-3 text-[15px] leading-7 text-[#667085]">Enter a strong password for your MECATREX account.</p>
          {error && <p role="alert" className="mt-5 rounded-[14px] bg-[#FEF3F2] p-4 text-[14px] text-[#B42318]">{error}</p>}
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
