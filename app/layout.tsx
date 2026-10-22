import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hellobase CRM",
  description: "A calm place for inquiries, clients, and tasks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
