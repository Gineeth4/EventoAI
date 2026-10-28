const INTERNAL_ORIGIN = "https://eventoai.invalid";

export function getSafeNextPath(
  candidate: string | null | undefined,
): string {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f]/.test(candidate)
  ) {
    return "/plan";
  }

  try {
    const resolved = new URL(candidate, INTERNAL_ORIGIN);

    if (resolved.origin !== INTERNAL_ORIGIN) {
      return "/plan";
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/plan";
  }
}