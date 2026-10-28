import type { ReactNode } from "react";

import "./events.css";
import "./event-actions.css";

export const metadata = {
  title: "My Events | EventoAI",
  description:
    "View your saved event plans, budget breakdowns, recommendations, and preparation timelines.",
};

export default function EventsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}