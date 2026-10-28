import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
            const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[EventoAI] Email callback code exchange failed.", {
          errorName: error.name || "AuthError",
          status: error.status ?? null,
          code: error.code ?? null,
        });
      } else {
        return NextResponse.redirect(
          new URL(nextPath, requestUrl.origin),
        );
      }
    } catch {
      // Redirect to a safe error page below.
    }
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", "confirmation");
  return NextResponse.redirect(loginUrl);
}