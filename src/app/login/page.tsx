import Link from "next/link";
import { Suspense } from "react";

import LoginForm from "@/components/auth/login-form";
import "./login.css";

export const metadata = {
  title: "Sign In | EventoAI",
  description: "Sign in or create an account to continue planning with EventoAI.",
};

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">E</span>
          <span>
            <strong>EventoAI</strong>
            <small>Moments, thoughtfully planned</small>
          </span>
        </Link>

        <Suspense fallback={<p className="auth-loading">Loading sign-in…</p>}>
          <LoginForm />
        </Suspense>

        <p className="auth-privacy-note">
          Your account protects access to your planning workspace.
        </p>
      </section>
    </main>
  );
}