
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    notice?: string;
    next?: string;
    email?: string;
  }>;
}) {
  const params = await searchParams;

  const next = params.next ?? "";
  const isAdminLogin =
    next === "/admin" ||
    next.startsWith("/admin?") ||
    next.startsWith("/admin#");

  const adminEmail =
    process.env.MECATREX_ADMIN_EMAIL?.trim() ||
    "RaselChowdhury12345@hotmail.com";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.account_type === "admin") {
      redirect("/admin");
    }

    if (!isAdminLogin) {
      redirect("/account");
    }

    // If a customer or provider opens an admin-only link,
    // show the login form to allow an intentional account switch.
    // No automatic sign-out happens here.
  }

  const prefilledEmail =
    params.email || (isAdminLogin ? adminEmail : "");

  return (
    <main className="min-h-screen bg-[#F5F7FA] px-5 py-10">
      <div className="mx-auto max-w-[620px]">
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
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#4771A6]">
            {isAdminLogin ? "MECATREX ADMINISTRATION" : "WELCOME BACK"}
          </p>

          <h1 className="mt-3 text-[35px] font-bold tracking-[-0.04em] text-[#101828] sm:text-[44px]">
            {isAdminLogin
              ? "Admin sign in."
              : "Log in to MECATREX."}
          </h1>

          <p className="mt-3 text-[16px] leading-7 text-[#667085]">
            {isAdminLogin
              ? "Sign in to review provider applications, approve businesses and manage MECATREX."
              : "Access your account, bookings, and provider dashboard."}
          </p>

          {user && isAdminLogin && (
            <div className="mt-5 rounded-[15px] border border-[#D6E0ED] bg-[#EDF3FA] px-4 py-3 text-[13px] leading-6 text-[#344054]">
              You are currently signed in with another account.
              Sign in as the administrator to switch accounts.
            </div>
          )}

          {params.notice && (
            <div
              role="status"
              className="mt-6 rounded-[15px] bg-[#ECFDF3] px-4 py-3 text-[14px] font-semibold text-[#027A48]"
            >
              {params.notice}
            </div>
          )}

          {params.error && (
            <div
              role="alert"
              className="mt-6 rounded-[15px] bg-[#FEF3F2] px-4 py-3 text-[14px] font-semibold text-[#B42318]"
            >
              {params.error}
            </div>
          )}

          <form action={login} className="mt-8 space-y-5">
            <input
              type="hidden"
              name="next"
              value={next}
            />

            <label className="block">
              <span className="mb-2 block text-[13px] font-bold text-[#344054]">
                Email
              </span>

              <input
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={prefilledEmail}
                required
                className="h-[55px] w-full rounded-[15px] border border-[#D0D5DD] bg-white px-4 text-[16px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
              />
            </label>

            <label className="block">
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="text-[13px] font-bold text-[#344054]">
                  Password
                </span>

                <Link
                  href="/forgot-password"
                  className="text-[13px] font-bold text-[#4771A6] underline underline-offset-2 hover:text-[#315C91]"
                >
                  Forgot password?
                </Link>
              </div>

              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-[55px] w-full rounded-[15px] border border-[#D0D5DD] bg-white px-4 text-[16px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-[15px] bg-[#4771A6] px-6 py-4 text-[16px] font-bold text-white transition hover:bg-[#3C6190]"
            >
              {isAdminLogin
                ? "Access admin dashboard"
                : "Log in"}
            </button>
          </form>

          {!isAdminLogin && (
            <p className="mt-7 text-center text-[14px] text-[#667085]">
              Don&apos;t have an account?{" "}
              <Link
                href={
                  next
                    ? `/signup?next=${encodeURIComponent(next)}`
                    : "/signup"
                }
                className="font-bold text-[#4771A6]"
              >
                Sign up
              </Link>
            </p>
          )}

          <p className="mt-6 text-center text-[12px] text-[#98A2B3]">
            Your session stays active while you navigate MECATREX.
          </p>
        </div>
      </div>
    </main>
  );
}
