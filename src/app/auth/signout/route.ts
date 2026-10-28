import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return NextResponse.json(
          { error: "Cross-origin sign-out requests are not allowed." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid Origin header." },
        { status: 403 },
      );
    }
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Always redirect to a local page.
  }

  return NextResponse.redirect(
    new URL("/login?message=signed-out", request.url),
    303,
  );
}