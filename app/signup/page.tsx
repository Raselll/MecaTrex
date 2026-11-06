import Image from "next/image";
import Link from "next/link";
import SignupForm from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#F5F7FA] px-5 py-10">
      <div className="mx-auto max-w-[740px]">
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

        <div className="mt-8 rounded-[30px] border border-[#EAECF0] bg-white p-7 shadow-[0_18px_60px_rgba(16,24,40,0.08)] sm:p-10">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">Join MECATREX</p>
          <h1 className="mt-3 text-[37px] font-bold tracking-[-0.04em] text-[#101828] sm:text-[44px]">Create your account.</h1>
          <p className="mt-3 text-[16px] leading-7 text-[#667085]">
            Book vehicle services as a client, or join MECATREX as a garage or towing provider.
          </p>

          <SignupForm error={params.error} />

          <p className="mt-7 text-center text-[14px] text-[#667085]">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[#4771A6]">Log in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
