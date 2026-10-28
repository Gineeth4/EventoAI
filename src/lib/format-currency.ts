export type CurrencyFormatOptions = {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
};

export function formatCurrency(
  amount: number,
  currencyCode: string,
  options: CurrencyFormatOptions = {},
): string {
  if (!Number.isFinite(amount)) return "Not available";

  const currency = currencyCode.trim().toUpperCase();
  const numberOptions: Intl.NumberFormatOptions = {
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    ...(options.minimumFractionDigits === undefined
      ? {}
      : { minimumFractionDigits: options.minimumFractionDigits }),
  };

  if (!/^[A-Z]{3}$/.test(currency)) {
    const number = new Intl.NumberFormat("en-IN", numberOptions).format(amount);
    return `${currency || "Currency"} ${number}`;
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      ...numberOptions,
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    const number = new Intl.NumberFormat("en-IN", numberOptions).format(amount);
    return `${currency} ${number}`;
  }
}
