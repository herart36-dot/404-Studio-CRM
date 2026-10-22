import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hellobase CRM | Know who's waiting on you",
  description:
    "Hellobase CRM shows you who is waiting for a reply, who has gone quiet, and what to do today. A live waiting timer, going-cold alerts, cases with SLA tracking and an AI assistant. $8 a month.",
  manifest: "/manifest.webmanifest",
  openGraph: { title: "Hellobase CRM", description: "A calm CRM for small teams. $8 a month.", type: "website" },
};

export const viewport: Viewport = { themeColor: "#2563eb" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
