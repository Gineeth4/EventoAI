/**
 * Convert a newline-separated requirement field into a normalized list.
 * Duplicate entries are removed case-insensitively while preserving order.
 */
export function parseRequirementLines(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of value.split(/\r?\n/)) {
    const item = line
      .replace(/^\s*(?:[-*?]\s+)/u, "")
      .trim();

    if (!item) {
      continue;
    }

    const key = item.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}
