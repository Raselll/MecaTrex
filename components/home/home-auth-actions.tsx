"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function HomeAuthActions() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<"loading" | "signed-in" | "signed-out">("loading");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let live = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (live) setSession(data.user ? "signed-in" : "signed-out");
    }).catch(() => {
      if (live) setSession("signed-out");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (live) setSession(authSession?.user ? "signed-in" : "signed-out");
    });

    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (!error) {
      setSession("signed-out");
      router.refresh();
    }
  }

  if (session === "loading") {
    return <div aria-label="Checking your session" className="h-[46px] w-[190px] animate-pulse rounded-xl bg-[#FFF1E8]" />;
  }

  if (session === "signed-in") {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/account" className="rounded-xl bg-[#16191D] px-4 py-3 text-[13px] font-bold text-white transition hover:bg-[#E94C09] sm:px-5 sm:text-[15px]">
          My account
        </Link>
        <button type="button" onClick={() => void logout()} disabled={signingOut} className="rounded-xl border border-[#E9DED5] bg-white px-3 py-3 text-[12px] font-bold text-[#344054] transition hover:bg-[#F2F4F7] disabled:opacity-50 sm:px-4 sm:text-[14px]">
          {signingOut ? "Signing out…" : "Log out"}
        </button>
      </div>
    );
  }

  return (
    <div className="bw-auth-actions flex items-center gap-2 sm:gap-4">
      <Link href="/login" className="rounded-xl px-3 py-3 text-[13px] font-semibold text-[#344054] transition hover:bg-[#F2F4F7] sm:px-6 sm:text-[17px]">
        Log in
      </Link>
      <Link href="/signup" className="rounded-xl bg-[#101828] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#FF5B13] sm:px-7 sm:text-[17px]">
        Sign up
      </Link>
    </div>
  );
}
