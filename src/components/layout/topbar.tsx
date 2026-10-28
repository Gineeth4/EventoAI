"use client";

import Link from "next/link";
import { Menu, Plus } from "lucide-react";

type TopbarProps = {
  onMenuClick: () => void;
};

export default function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="workspace-topbar">
      <div className="workspace-topbar-left">
        <button
          type="button"
          className="workspace-menu-button"
          onClick={onMenuClick}
          aria-label="Toggle workspace navigation"
        >
          <Menu aria-hidden="true" />
        </button>

        <div className="workspace-topbar-heading">
          <span className="workspace-breadcrumb">
            EventoAI / Workspace
          </span>

          <strong>Your planning workspace</strong>
        </div>
      </div>

      <div className="workspace-topbar-actions">
        <Link className="button-primary" href="/events">
          <Plus aria-hidden="true" />
          <span>New event</span>
        </Link>

        {/* Placeholder avatar until authentication is implemented. */}
        <div
          className="workspace-user-avatar"
          aria-label="Demo user profile placeholder"
          title="Profile"
        >
          E
        </div>
      </div>
    </header>
  );
}