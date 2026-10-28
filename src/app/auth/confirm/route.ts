import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const nextPath = getSafeNextPath(
    requestUrl.searchParams.get("next"),
  );

  if (tokenHash && type === "email") {
    try {
      const supabase = await createClient();

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "email",
      });

      if (!error) {
        return NextResponse.redirect(
          new URL(nextPath, requestUrl.origin),
        );
      }

      console.error("[EventoAI] Email confirmation verification failed.", {
        errorName: error.name || "AuthError",
        status: error.status ?? null,
        code: error.code ?? null,
      });
    } catch (error) {
      console.error("[EventoAI] Email confirmation handler failed.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", "confirmation");

  return NextResponse.redirect(loginUrl);
}