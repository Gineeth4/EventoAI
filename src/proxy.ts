import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const pathname = request.nextUrl.pathname;

  const isProtectedPage =
    pathname === "/plan" ||
    pathname.startsWith("/plan/") ||
    pathname === "/events" ||
    pathname.startsWith("/events/");

  if (!url || !key) {
    if (isProtectedPage) {
      return new NextResponse(
        "Authentication is not configured. Please try again later.",
        { status: 503 },
      );
    }

    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        supabaseResponse = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  let hasVerifiedSession = false;

  try {
    const { data, error } = await supabase.auth.getClaims();
    hasVerifiedSession = !error && Boolean(data?.claims?.sub);
  } catch {
    hasVerifiedSession = false;
  }

  if (isProtectedPage && !hasVerifiedSession) {
    const loginUrl = new URL("/login", request.url);

    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );

    const redirectResponse = NextResponse.redirect(loginUrl);

    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};