"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getSafeNextPath } from "@/lib/auth/safe-next-path";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  // Remove credentials from any URL left by an earlier native form submission.
  useEffect(() => {
    const url = new URL(window.location.href);

    if (
      !url.searchParams.has("email") &&
      !url.searchParams.has("password")
    ) {
      return;
    }

    url.searchParams.delete("email");
    url.searchParams.delete("password");

    const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", cleanUrl);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorMessage("");
    setNotice("");

    try {
      const supabase = createClient();
      const nextPath = getSafeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      );

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        router.replace(nextPath);
        router.refresh();
        return;
      }

      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", nextPath);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: callbackUrl.toString() },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      setNotice(
        "Account request received. Check your email for a confirmation link before signing in.",
      );
    } catch {
      setErrorMessage(
        "Authentication is temporarily unavailable. Check your connection and Supabase configuration, then try again.",
      );
    } finally {
      setPending(false);
    }
  }

  function changeMode() {
    setMode((current) => current === "signin" ? "signup" : "signin");
    setErrorMessage("");
    setNotice("");
  }

  return (
    <div className="auth-form-wrap">
      <p className="auth-eyebrow">YOUR EVENT STUDIO</p>
      <h1>{mode === "signin" ? "Welcome back." : "Create your account."}</h1>
      <p className="auth-intro">
        {mode === "signin"
          ? "Sign in to continue planning your next meaningful moment."
          : "Create an account to start building and refining your event plans."}
      </p>

      <form method="post" className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="auth-email">Email address</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          maxLength={254}
          disabled={pending}
        />

        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
          minLength={8}
          required
          disabled={pending}
        />

        {errorMessage && (
          <p className="auth-error" role="alert">{errorMessage}</p>
        )}

        {notice && (
          <p className="auth-notice" role="status">{notice}</p>
        )}

        <button className="auth-submit" type="submit" disabled={pending}>
          {pending
            ? "Please wait..."
            : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="auth-switch">
        {mode === "signin" ? "New to EventoAI?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="auth-switch-button"
          onClick={changeMode}
          disabled={pending}
        >
          {mode === "signin" ? "Create an account" : "Sign in instead"}
        </button>
      </p>

      <Link href="/" className="auth-home-link">Return to EventoAI home</Link>
    </div>
  );
}