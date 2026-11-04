import Image from "next/image";
import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  return (
    <main className="min-h-screen bg-[#F5F7FA] px-5 py-10 text-[#101828]">
      <div className="mx-auto max-w-[620px]">
        <Link href="/" aria-label="Back to MECATREX">
          <Image src="/mecatrex-logo-web.png" alt="MECATREX" width={280} height={78} priority className="h-[58px] w-auto" />
        </Link>
        <div className="mt-8 rounded-[30px] border border-[#EAECF0] bg-white p-7 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-10">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">Account recovery</p>
          <h1 className="mt-3 text-[38px] font-bold tracking-[-0.04em]">Forgot your password?</h1>
          <p className="mt-3 text-[15px] leading-7 text-[#667085]">Enter your email and we will send a secure link so you can choose a new password.</p>
          {sent ? (
            <div role="status" className="mt-7 rounded-[16px] border border-[#ABEFC6] bg-[#ECFDF3] p-5 text-[14px] leading-6 text-[#05603A]">
              If this email is registered with MECATREX, a password reset link has been sent. Check your inbox and spam folder.
            </div>
          ) : (
            <form action={requestPasswordReset} className="mt-7 space-y-5">
              {error && <p role="alert" className="rounded-[14px] bg-[#FEF3F2] px-4 py-3 text-[14px] text-[#B42318]">{error}</p>}
              <label className="block">
                <span className="mb-2 block text-[14px] font-bold text-[#101828]">Email address</span>
                <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="h-[54px] w-full rounded-[14px] border border-[#98A2B3] bg-white px-4 text-[16px] outline-none focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10" />
              </label>
              <button type="submit" className="w-full rounded-[14px] bg-[#4771A6] px-5 py-4 text-[16px] font-bold text-white hover:bg-[#315C91]">Send reset link</button>
            </form>
          )}
          <Link href="/login" className="mt-6 inline-flex text-[14px] font-bold text-[#4771A6] underline underline-offset-2 hover:text-[#315C91]">← Back to log in</Link>
        </div>
      </div>
    </main>
  );
}
