export type InferredEventDetails = {
  eventType?: string;
  title: string;
  eventDate?: string;
  guestCount?: number;
  currency?: string;
  totalAmount?: number;
  venueType?: "indoor" | "outdoor";
  themes: string[];
  styles: string[];
};

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function inferDate(text: string): string | undefined {
  const isoMatch = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(text);

  if (isoMatch && isValidDateOnly(isoMatch[1])) {
    return isoMatch[1];
  }

  const months: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };

  const monthPattern =
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i;

  const match = monthPattern.exec(text);

  if (!match) {
    return undefined;
  }

  const day = Number(match[1]);
  const monthKey = match[2].toLowerCase();
  const month = months[monthKey];
  const year = Number(match[3]);

  if (!month) {
    return undefined;
  }

  const value = `${year}-${month}-${String(day).padStart(2, "0")}`;

  return isValidDateOnly(value) ? value : undefined;
}

function currencyFromToken(
  token: string | undefined,
): string | undefined {
  if (!token) {
    return undefined;
  }

  const normalized = token.trim().toUpperCase();

  if (
    normalized.includes("₹") ||
    normalized === "INR" ||
    normalized.startsWith("RS")
  ) {
    return "INR";
  }

  if (normalized.includes("$") || normalized === "USD") {
    return "USD";
  }

  if (normalized.includes("£") || normalized === "GBP") {
    return "GBP";
  }

  if (normalized.includes("€") || normalized === "EUR") {
    return "EUR";
  }

  return undefined;
}

function parseAmount(
  value: string,
  scale?: string,
): number | undefined {
  const amount = Number(value.replaceAll(",", ""));

  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  const normalizedScale = scale?.toLowerCase();

  let multiplier = 1;

  if (
    normalizedScale === "k" ||
    normalizedScale === "thousand"
  ) {
    multiplier = 1_000;
  } else if (
    normalizedScale === "lakh" ||
    normalizedScale === "lac"
  ) {
    multiplier = 100_000;
  } else if (normalizedScale === "million") {
    multiplier = 1_000_000;
  }

  const result = amount * multiplier;

  return Number.isFinite(result) && result > 0
    ? result
    : undefined;
}

function inferBudget(
  text: string,
): { totalAmount?: number; currency?: string } {
  // Example: "budget around ₹25,000" or "budget 25k".
  const budgetMatch =
    /\bbudget\b.{0,20}?(₹|INR\b|Rs\.?|USD\b|\$|GBP\b|£|EUR\b|€)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lac|million)?\s*(INR|USD|GBP|EUR)?/i.exec(
      text,
    );

  if (budgetMatch) {
    const amount = parseAmount(
      budgetMatch[2],
      budgetMatch[3],
    );

    if (amount !== undefined) {
      return {
        totalAmount: amount,
        currency:
          currencyFromToken(budgetMatch[1]) ??
          currencyFromToken(budgetMatch[4]),
      };
    }
  }

  // Example: "₹25,000" or "USD 500".
  const markedMatch =
    /(₹|INR\b|Rs\.?|USD\b|\$|GBP\b|£|EUR\b|€)\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lac|million)?/i.exec(
      text,
    );

  if (markedMatch) {
    const amount = parseAmount(
      markedMatch[2],
      markedMatch[3],
    );

    if (amount !== undefined) {
      return {
        totalAmount: amount,
        currency: currencyFromToken(markedMatch[1]),
      };
    }
  }

  // Example: "25,000 INR".
  const suffixMatch =
    /(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lac|million)?\s*(INR|USD|GBP|EUR)\b/i.exec(
      text,
    );

  if (suffixMatch) {
    const amount = parseAmount(
      suffixMatch[1],
      suffixMatch[2],
    );

    if (amount !== undefined) {
      return {
        totalAmount: amount,
        currency: currencyFromToken(suffixMatch[3]),
      };
    }
  }

  return {};
}

function inferTitle(text: string): string {
  const cleaned = text
    .trim()
    .replace(
      /^(?:please\s+)?(?:help me (?:plan|organize)|i want to|i need to|i would like to|i'd like to|i am planning|i'm planning|plan)\s+(?:have\s+|host\s+|organize\s+|a\s+|an\s+|the\s+)?/i,
      "",
    );

  const firstSentence =
    cleaned.split(/[.!?\n]/)[0]?.trim() ?? "";

  const words = firstSentence.split(/\s+/);

  const title =
    words.length > 9
      ? `${words.slice(0, 9).join(" ")}…`
      : firstSentence;

  if (!title) {
    return "";
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function inferEventBriefFromText(
  rawText: string,
): InferredEventDetails {
  const text = rawText.trim();

  let eventType: string | undefined;

  if (/\b(birthday|bday)\b/i.test(text)) {
    eventType = "birthday";
  } else if (
    /\b(wedding|marriage ceremony|wedding ceremony)\b/i.test(
      text,
    )
  ) {
    eventType = "wedding";
  } else if (
    /\b(anniversary|anniversary celebration)\b/i.test(text)
  ) {
    eventType = "anniversary";
  } else if (
    /\b(community event|fundraiser|neighborhood event|charity event|community gathering)\b/i.test(
      text,
    )
  ) {
    eventType = "community";
  } else if (
    /\b(corporate event|conference|product launch|company event|seminar)\b/i.test(
      text,
    )
  ) {
    eventType = "corporate";
  }

  const guestMatch =
    /\b(\d{1,5})\s*(?:guests?|people|persons?|attendees|friends|family members)\b/i.exec(
      text,
    );

  const guestCount = guestMatch
    ? Number(guestMatch[1])
    : undefined;

  const budget = inferBudget(text);

  const themes: string[] = [];
  const styles: string[] = [];

  const themeRules: [string, RegExp][] = [
    ["botanical", /\b(botanical|garden|floral|flowers?)\b/i],
    ["modern", /\b(modern|contemporary)\b/i],
    ["minimalist", /\b(minimal|minimalist|simple|uncluttered)\b/i],
    ["rustic", /\b(rustic|farmhouse|woodland)\b/i],
    ["cultural", /\b(cultural|traditional|heritage)\b/i],
    ["playful", /\b(playful|whimsical|colourful|colorful)\b/i],
    ["elegant", /\b(elegant|refined|luxury|luxurious|classy)\b/i],
  ];

  for (const [theme, pattern] of themeRules) {
    if (pattern.test(text)) {
      themes.push(theme);
    }
  }

  const styleRules: [string, RegExp][] = [
    [
      "family-friendly",
      /\b(family-friendly|family friendly|for children)\b/i,
    ],
    ["relaxed", /\b(relaxed|casual|laid-back|laid back)\b/i],
    ["elegant", /\b(elegant|refined|sophisticated)\b/i],
    ["practical", /\b(practical|simple|easy to organize)\b/i],
    ["playful", /\b(fun|playful|whimsical)\b/i],
    ["premium", /\b(luxury|luxurious|premium|high-end)\b/i],
  ];

  for (const [style, pattern] of styleRules) {
    if (pattern.test(text)) {
      styles.push(style);
    }
  }

  let venueType: "indoor" | "outdoor" | undefined;

  if (
    /\b(outdoor|outside|garden|beach|park|open-air)\b/i.test(
      text,
    )
  ) {
    venueType = "outdoor";
  } else if (
    /\b(indoor|inside|restaurant|banquet hall|indoor hall)\b/i.test(
      text,
    )
  ) {
    venueType = "indoor";
  }

  return {
    eventType,
    title: inferTitle(text),
    eventDate: inferDate(text),
    guestCount:
      guestCount &&
      guestCount >= 1 &&
      guestCount <= 10_000
        ? guestCount
        : undefined,
    currency: budget.currency,
    totalAmount: budget.totalAmount,
    venueType,
    themes,
    styles,
  };
}