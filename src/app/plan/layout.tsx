import type { ReactNode } from "react";

import "./plan.css";
import "./conversation.css";

export default function PlanLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}