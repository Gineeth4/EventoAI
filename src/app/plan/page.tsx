import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import SignOutButton from "@/components/auth/sign-out-button";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";

import ConversationalPlanner from "@/components/planner/conversational-planner";

export const metadata = {
  title: "Create an Event Plan | EventoAI",
  description:
    "Describe your idea, build a personalized event brief, and create a thoughtful event plan with transparent budget calculations and preparation tasks.",
};

export default function PlanPage() {
  return (
    <Suspense
      fallback={
        <main className="plan-page">
          <div className="plan-container">
            <p role="status">Loading your planning workspace...</p>
          </div>
        </main>
      }
    >
      <AuthenticatedPlanPage />
    </Suspense>
  );
}

async function AuthenticatedPlanPage() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fplan");
  }

  return (
    <main className="plan-page">
      <div className="plan-container">
        <header className="plan-header">
          <Link className="plan-brand" href="/">
            <span className="plan-brand-icon">
              <CalendarDays size={21} aria-hidden="true" />
            </span>

            <span>
              <strong>EventoAI</strong>
              <small>Moments, thoughtfully planned</small>
            </span>
          </Link>

          <div className="plan-header-controls">
            <Link className="plan-back-link" href="/">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to home
            </Link>
            <SignOutButton email={user.email} />
          </div>
        </header>

        <div className="plan-notice">
          <ShieldCheck size={17} aria-hidden="true" />
          <p>
            Your plan is built around your preferences. Budget totals are
            calculated by application logic, and allocations are
            distinguished from verified quotes.
          </p>
        </div>

        <ConversationalPlanner />

        <footer className="plan-footer">
          <p>
            EventoAI helps you organize decisions. Confirm important costs
            and vendor availability before making commitments.
          </p>
        </footer>
      </div>
    </main>
  );
}