
"use client";

import type { ReactNode } from "react";
import SignupReadiness from "./signup-readiness";

export default function SignupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <SignupReadiness />
    </>
  );
}
