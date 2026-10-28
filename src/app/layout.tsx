import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./design-system.css";
import "./landing-page.css";

export const metadata: Metadata = {
  title: {
    default: "EventoAI - Plan smarter. Celebrate better.",
    template: "%s | EventoAI",
  },
  description:
    "Plan weddings, birthdays, and community events with personalized AI ideas, budget intelligence, timelines, and smarter event coordination.",
  applicationName: "EventoAI",
  keywords: [
    "EventoAI",
    "AI event planner",
    "wedding planning",
    "birthday planning",
    "community events",
    "event budgeting",
    "event management",
  ],
  openGraph: {
    title: "EventoAI - Plan smarter. Celebrate better.",
    description:
      "Turn your event idea into a thoughtful, organized plan with AI-assisted budgeting, scheduling, and recommendations.",
    siteName: "EventoAI",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#faf8f2",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}