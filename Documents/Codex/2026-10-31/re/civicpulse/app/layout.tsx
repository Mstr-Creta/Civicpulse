import type { Metadata, Viewport } from "next";
import RegisterServiceWorker from "@/components/register-service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: "CivicPulse — See what needs attention",
  description: "A community issue board for local streets and public spaces.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#fbfbfa",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><RegisterServiceWorker />{children}</body>
    </html>
  );
}
