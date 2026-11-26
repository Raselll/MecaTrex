import type { Metadata } from "next";
import { Geist } from "next/font/google";
import ClientNavigation from "./client-navigation";

import "./globals.css";
import "./garage-images.css";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BandWhip | Book car care without the runaround",
  icons: { icon: "/bandwhip-icon.svg", shortcut: "/bandwhip-icon.svg", apple: "/bandwhip-icon.svg" },
  description:
    "Find and compare garage services, browse local availability and book instantly with BandWhip.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.className} bw-site-body`}>
        <ClientNavigation />
        {children}
      </body>
    </html>
  );
}
