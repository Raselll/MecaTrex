
"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useState,
} from "react";

import {
  resendConfirmation,
  type ResendState,
} from "./actions";

const INITIAL_RESEND_STATE: ResendState = {
  status: "idle",
  message: "",
  retryAfterSeconds: 0,
  requestId: 0,
};

export default function ResendForm({
  initialEmail,
  lastRequest,
}: {
  initialEmail: string;
  lastRequest: number;
}) {
  const [state, action, isPending] = useActionState(
    resendConfirmation,
    INITIAL_RESEND_STATE
  );

  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (lastRequest > 0) {
      setSecondsLeft(Math.max(0, Math.ceil((60_000 - (Date.now() - lastRequest)) / 1000)));
    }
  }, [lastRequest]);

  useEffect(() => {
    if (state.requestId > 0) {
      setSecondsLeft(state.retryAfterSeconds);
    }
  }, [state.requestId, state.retryAfterSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const timer = window.setTimeout(() => {
      setSecondsLeft((current) =>
        Math.max(0, current - 1)
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <section
      aria-labelledby="resend-title"
      className="mt-8 rounded-[22px] border border-[#DCE5F0] bg-[#F8FAFD] p-5 text-left sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#4771A6] shadow-sm"
          aria-hidden="true"
        >
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.5 8.5 0 0 1-14.8 5.7" />
            <path d="M3 12.5A8.5 8.5 0 0 1 17.8 6.8" />
            <path d="M3 17v-5h5" />
            <path d="M21 7v5h-5" />
          </svg>
        </span>

        <div>
          <h2
            id="resend-title"
            className="text-[17px] font-bold text-[#101828]"
          >
            Didn&apos;t receive the email?
          </h2>

          <p className="mt-1 text-[13px] leading-6 text-[#667085]">
            Check your spam folder first. You can
            request a new confirmation link below.
          </p>
        </div>
      </div>

      <form
        action={action}
        className="mt-5 space-y-3"
      >
        <label
          htmlFor="confirmation-email"
          className="block text-[13px] font-bold text-[#344054]"
        >
          Email used during sign-up
        </label>

        <input
          id="confirmation-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          defaultValue={initialEmail}
          placeholder="you@example.com"
          className="h-[52px] w-full rounded-[13px] border border-[#C9D5E3] bg-white px-4 text-[15px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4771A6] focus:ring-4 focus:ring-[#4771A6]/10"
        />

        <button
          type="submit"
          disabled={isPending || secondsLeft > 0}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[13px] bg-[#4771A6] px-5 py-3.5 text-[14px] font-bold text-white transition hover:bg-[#315C91] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4771A6] disabled:cursor-not-allowed disabled:bg-[#AFC0D4]"
        >
          {isPending ? (
            <>
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white"
              />
              Requesting your link…
            </>
          ) : secondsLeft > 0 ? (
            `Resend available in ${secondsLeft}s`
          ) : (
            "Resend confirmation link"
          )}
        </button>
      </form>

      {state.status !== "idle" && (
        <div
          role={
            state.status === "error"
              ? "alert"
              : "status"
          }
          aria-live="polite"
          className={`mt-4 rounded-[13px] border px-4 py-3 text-[13px] font-medium leading-6 ${
            state.status === "success"
              ? "border-[#ABEFC6] bg-[#ECFDF3] text-[#027A48]"
              : "border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]"
          }`}
        >
          {state.message}
        </div>
      )}

      <p className="mt-4 text-[12px] leading-5 text-[#667085]">
        The email must match your original sign-up
        address. Entered the wrong address when signing
        up?{" "}
        <Link
          href="/signup"
          className="font-bold text-[#315C91] underline underline-offset-2"
        >
          Start again
        </Link>.
      </p>
    </section>
  );
}
