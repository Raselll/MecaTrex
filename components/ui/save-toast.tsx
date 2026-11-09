
"use client";

import { useEffect, useRef, useState } from "react";

type Toast = {
  id: number;
  message: string;
  kind: "success" | "error";
};

const SUCCESS_WORDS =
  /\b(saved|updated|added|removed|published|successfully|confirmed|completed|blocked|cancelled|canceled|resent)\b/i;

const ERROR_WORDS =
  /\b(error|failed|could not|unable to|invalid|cannot save)\b/i;

export default function SaveToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef({ message: "", time: 0 });
  const counter = useRef(0);

  useEffect(() => {
    function display(message: string, kind: Toast["kind"]) {
      const clean = message.replace(/\s+/g, " ").trim();

      if (!clean || clean.length > 350) return;

      const now = Date.now();

      if (
        last.current.message === clean &&
        now - last.current.time < 1000
      ) {
        return;
      }

      last.current = { message: clean, time: now };
      counter.current += 1;

      setToast({
        id: counter.current,
        message: clean,
        kind,
      });

      if (timer.current) clearTimeout(timer.current);

      timer.current = setTimeout(() => {
        setToast(null);
      }, 4500);
    }

    function check(element: Element) {
      if (element.closest("[data-mecatrex-toast]")) return;

      const role = element.getAttribute("role");
      if (role !== "status" && role !== "alert") return;

      const message = element.textContent?.trim() || "";
      if (!message || message.length > 350) return;

      if (role === "status" && SUCCESS_WORDS.test(message)) {
        display(message, "success");
      }

      if (role === "alert" && ERROR_WORDS.test(message)) {
        display(message, "error");
      }
    }

    function inspect(node: Node) {
      const element =
        node instanceof Element
          ? node
          : node.parentElement;

      if (!element) return;

      if (element.matches('[role="status"],[role="alert"]')) {
        check(element);
      }

      const parent = element.closest(
        '[role="status"],[role="alert"]'
      );
      if (parent) check(parent);

      element
        .querySelectorAll('[role="status"],[role="alert"]')
        .forEach(check);
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          inspect(mutation.target);
          continue;
        }

        mutation.addedNodes.forEach(inspect);
      }
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    function handleCustomToast(event: Event) {
      const custom = event as CustomEvent<{
        message?: string;
        kind?: "success" | "error";
      }>;

      if (custom.detail?.message) {
        display(
          custom.detail.message,
          custom.detail.kind || "success"
        );
      }
    }

    window.addEventListener(
      "mecatrex:toast",
      handleCustomToast
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "mecatrex:toast",
        handleCustomToast
      );

      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      data-mecatrex-toast
      className="pointer-events-none fixed right-4 top-5 z-[9999] w-[calc(100%-2rem)] max-w-[390px] sm:right-6"
    >
      <div
        key={toast.id}
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex items-start gap-3 rounded-[18px] border bg-white p-4 shadow-[0_16px_55px_rgba(16,24,40,0.18)] ${
          toast.kind === "success"
            ? "border-[#A6E4BF]"
            : "border-[#FDA29B]"
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] font-bold ${
            toast.kind === "success"
              ? "bg-[#ECFDF3] text-[#027A48]"
              : "bg-[#FEF3F2] text-[#B42318]"
          }`}
        >
          {toast.kind === "success" ? "✓" : "!"}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-[#101828]">
            {toast.kind === "success"
              ? "Changes saved"
              : "Action failed"}
          </p>

          <p className="mt-1 text-[12px] leading-5 text-[#667085]">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => setToast(null)}
          className="rounded-lg p-1 text-[#667085] hover:bg-[#F2F4F7]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
  