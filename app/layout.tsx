import type { Metadata } from "next";
import { Geist } from "next/font/google";
import ClientNavigation from "./client-navigation";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MECATREX",
  description:
    "Find and book the right garage for your vehicle in under one minute.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <ClientNavigation />
        {children}
      </body>
    </html>
  );
}
