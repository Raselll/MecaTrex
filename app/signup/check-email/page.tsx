
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import ResendForm from "./resend-form";

export const dynamic = "force-dynamic";

export default async function CheckEmailPage() {
  const cookieStore = await cookies();

  const initialEmail =
    cookieStore.get("mecatrex_signup_email")?.value ?? "";

  const lastRequest = Number(
    cookieStore.get("mecatrex_confirmation_last_resend")?.value ?? 0
  );

  const initialCooldown =
    lastRequest > 0 && Date.now() - lastRequest >= 0
      ? Math.max(
          0,
          Math.ceil(
            (60_000 - (Date.now() - lastRequest)) / 1000
          )
        )
      : 0;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F5F7FA] px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-36 top-1/4 h-[420px] w-[420px] rounded-full bg-[#DBE9FA]/40 blur-[100px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 bottom-0 h-[440px] w-[440px] rounded-full bg-[#C9E0FA]/30 blur-[100px]"
      />

      <div className="relative z-10 w-full max-w-[590px]">
        <Link
          href="/"
          className="mx-auto mb-7 flex w-fit items-center justify-center"
          aria-label="MECATREX home"
        >
          <Image
            src="/mecatrex-logo-web.png"
            alt="MECATREX"
            width={210}
            height={60}
            priority
            className="h-[49px] w-auto"
          />
        </Link>

        <div className="rounded-[30px] border border-[#E4EAF2] bg-white px-5 py-8 shadow-[0_22px_70px_rgba(16,24,40,0.08)] sm:px-10 sm:py-10">
          <div className="mb-7 flex items-center justify-between gap-3 border-b border-[#EEF1F5] pb-5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#4771A6]">
              Almost there
            </span>

            <span className="rounded-full bg-[#EDF3FA] px-3 py-1.5 text-[11px] font-bold text-[#4771A6]">
              Step 2 of 2
            </span>
          </div>

          <div
            className="mx-auto flex h-[84px] w-[84px] items-center justify-center rounded-[26px] bg-[#EDF3FA] text-[#4771A6] shadow-[0_12px_30px_rgba(71,113,166,0.1)]"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 64 64"
              width="45"
              height="45"
              fill="none"
            >
              <rect
                x="7"
                y="15"
                width="50"
                height="35"
                rx="8"
                fill="#4771A6"
              />

              <path
                d="m11 22 21 15 21-15"
                stroke="#fff"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <circle cx="51" cy="13" r="9" fill="#fff" />

              <circle
                cx="51"
                cy="13"
                r="6.5"
                fill="#27AE78"
              />

              <path
                d="m48 13 2 2 4-4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="mt-6 text-center">
            <h1 className="text-[30px] font-extrabold tracking-[-0.045em] text-[#101828] sm:text-[36px]">
              Check your inbox.
            </h1>

            <p className="mx-auto mt-3 max-w-[430px] text-[15px] leading-7 text-[#667085]">
              Your MECATREX account is almost ready.
              Open the confirmation email and click
              the verification link to activate it.
            </p>

            {initialEmail && (
              <div className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[#E1E8F0] bg-[#F8FAFC] px-4 py-2 text-[13px] font-semibold text-[#315C91]">
                <span aria-hidden="true">✉</span>
                <span className="truncate">
                  {initialEmail}
                </span>
              </div>
            )}
          </div>

          <div className="mt-7 grid grid-cols-[auto_1fr] gap-x-3 gap-y-4 rounded-[20px] border border-[#E8EDF4] bg-white p-5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EDF3FA] text-[12px] font-extrabold text-[#4771A6]">
              1
            </div>

            <div>
              <p className="text-[14px] font-bold text-[#101828]">
                Open the confirmation email
              </p>

              <p className="mt-0.5 text-[12px] leading-5 text-[#667085]">
                Look in your inbox, junk or promotions folder.
              </p>
            </div>

            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EDF3FA] text-[12px] font-extrabold text-[#4771A6]">
              2
            </div>

            <div>
              <p className="text-[14px] font-bold text-[#101828]">
                Confirm and sign in
              </p>

              <p className="mt-0.5 text-[12px] leading-5 text-[#667085]">
                Tap the link in the email to finish
                creating your account.
              </p>
            </div>
          </div>

          <ResendForm
            initialEmail={initialEmail}
            initialCooldown={initialCooldown}
          />

          <div className="mt-7 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="text-[14px] font-bold text-[#315C91] underline underline-offset-4 hover:text-[#101828]"
            >
              Already verified? Log in
            </Link>

            <span
              className="hidden text-[#D0D5DD] sm:inline"
              aria-hidden="true"
            >
              •
            </span>

            <Link
              href="/"
              className="text-[14px] font-semibold text-[#667085] hover:text-[#101828]"
            >
              Back to MECATREX
            </Link>
          </div>
        </div>

        <p className="mt-5 text-center text-[12px] leading-5 text-[#98A2B3]">
          Secure email verification by MECATREX.
        </p>
      </div>
    </main>
  );
}
