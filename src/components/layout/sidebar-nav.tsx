"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type SidebarNavProps = {
  mobileOpen: boolean;
  onNavigate: () => void;
};

const navigationItems: NavigationItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My events",
    href: "/events",
    icon: CalendarDays,
  },
  {
    label: "Budget planner",
    href: "/budget",
    icon: Compass,
  },
  {
    label: "Timeline & tasks",
    href: "/timeline",
    icon: ClipboardCheck,
  },
  {
    label: "Ideas & recommendations",
    href: "/recommendations",
    icon: Lightbulb,
  },
];

export default function SidebarNav({
  mobileOpen,
  onNavigate,
}: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`workspace-sidebar${mobileOpen ? " is-open" : ""}`}
      aria-label="Workspace navigation"
    >
      <Link
        href="/dashboard"
        className="workspace-brand"
        onClick={onNavigate}
        aria-label="EventoAI workspace"
      >
        <span className="brand-mark" aria-hidden="true">
          <CalendarDays />
        </span>

        <span className="brand-wordmark">
          <strong>EventoAI</strong>
          <span>Planning workspace</span>
        </span>
      </Link>

      <div className="workspace-sidebar-section-label">
        Your workspace
      </div>

      <nav className="workspace-sidebar-nav" aria-label="Main workspace">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`workspace-nav-link${isActive ? " is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={onNavigate}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="workspace-sidebar-bottom">
        <div className="workspace-sidebar-tip">
          <span className="workspace-sidebar-tip-icon" aria-hidden="true">
            <Sparkles />
          </span>

          <strong>Plan with confidence</strong>

          <p>
            Keep ideas, budgets, and important tasks connected as your
            event takes shape.
          </p>
        </div>
      </div>
    </aside>
  );
}