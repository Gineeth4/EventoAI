"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import SidebarNav from "@/components/layout/sidebar-nav";
import Topbar from "@/components/layout/topbar";

type AppShellProps = {
  children: ReactNode;
};

/**
 * Shared layout for the authenticated planning workspace.
 *
 * The sidebar remains visible on desktop and becomes a slide-out
 * navigation panel on smaller screens.
 */
export default function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobileNavigation() {
    setMobileOpen(false);
  }

  function toggleMobileNavigation() {
    setMobileOpen((current) => !current);
  }

  return (
    <div className="workspace-shell">
      {mobileOpen && (
        <button
          type="button"
          className="workspace-overlay"
          onClick={closeMobileNavigation}
          aria-label="Close workspace navigation"
        />
      )}

      <SidebarNav
        mobileOpen={mobileOpen}
        onNavigate={closeMobileNavigation}
      />

      <div className="workspace-main">
        <Topbar onMenuClick={toggleMobileNavigation} />

        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}