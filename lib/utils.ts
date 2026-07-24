export function formatCurrency(
  value: number | string | null | undefined,
  currency: string = "PKR",
): string {
  try {
    const numericValue = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(numericValue)) {
      throw new Error("Invalid numeric value");
    }

    const normalizedCurrency = (currency || "PKR").toUpperCase();
    const formatter = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formattedValue = formatter.format(numericValue);

    if (normalizedCurrency === "USD") {
      return `$${formattedValue}`;
    }

    if (normalizedCurrency === "EUR") {
      return `€${formattedValue}`;
    }

    return `Rs. ${formattedValue}`;
  } catch {
    const fallbackValue = typeof value === "number" ? value : Number(value);
    const safeValue = Number.isFinite(fallbackValue) ? fallbackValue : 0;
    const formatter = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formattedFallback = formatter.format(safeValue);

    return `Rs. ${formattedFallback}`;
  }
}
