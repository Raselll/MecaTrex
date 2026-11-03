import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-5">
      <div className="w-full max-w-[550px] rounded-[30px] bg-white p-10 text-center shadow-[0_20px_70px_rgba(16,24,40,0.1)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EDF3FA] text-[30px]">✉️</div>
        <h1 className="mt-6 text-[34px] font-bold tracking-[-0.04em] text-[#101828]">Check your email.</h1>
        <p className="mt-4 text-[16px] leading-7 text-[#667085]">
          We sent you a confirmation link. Confirm your email to finish creating your MECATREX account.
        </p>
        <Link href="/" className="mt-7 inline-flex rounded-[14px] bg-[#4771A6] px-6 py-3.5 font-bold text-white">
          Back to MECATREX
        </Link>
      </div>
    </main>
  );
}
