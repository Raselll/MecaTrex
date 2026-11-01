"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClientNavigation() {
  const router = useRouter();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");

      if (!button) {
        return;
      }

      const label = button.textContent?.trim();

      if (label === "Sign up") {
        event.preventDefault();
        router.push("/signup");
      }

      if (label === "Log in") {
        event.preventDefault();
        router.push("/login");
      }
    }

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [router]);

  return null;
}
