import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function getExpectedRequestOrigin(request: Request): string | null {
  const requestUrl = new URL(request.url);
  const isVercel = process.env.VERCEL === "1";

  // Vercel overwrites these forwarding headers at its trusted edge.
  const forwardedHost = isVercel
    ? request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    : null;

  const forwardedProtocol = isVercel
    ? request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
    : null;

  // Prefer the browser-facing host over a potentially rewritten internal URL.
  const host =
    forwardedHost ||
    request.headers.get("host")?.trim() ||
    requestUrl.host;

  const protocol = (forwardedProtocol || requestUrl.protocol)
    .replace(/:$/, "")
    .toLowerCase();

  if (protocol !== "http" && protocol !== "https") {
    return null;
  }

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

function isSameOriginSignOutRequest(request: Request): boolean {
  if (
    request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site"
  ) {
    return false;
  }

  const expectedOrigin = getExpectedRequestOrigin(request);

  if (!expectedOrigin) {
    return false;
  }

  const origin = request.headers.get("origin");

  if (origin) {
    try {
      return new URL(origin).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");

  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOriginSignOutRequest(request)) {
    return NextResponse.json(
      { error: "Cross-origin sign-out requests are not allowed." },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Always redirect to a local page.
  }

  return NextResponse.redirect(
    new URL("/login?message=signed-out", request.url),
    {
      status: 303,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
