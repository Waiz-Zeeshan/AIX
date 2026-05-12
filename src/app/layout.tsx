import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tkxel AI Unlimited",
  description: "Team formation platform for the AI Unlimited Event"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
