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
    const currencySymbol =
      normalizedCurrency === "USD"
        ? "$"
        : normalizedCurrency === "EUR"
          ? "€"
          : "Rs.";

    return `${currencySymbol} ${numericValue.toFixed(2)}`;
  } catch {
    const fallbackValue = typeof value === "number" ? value : Number(value);
    const safeValue = Number.isFinite(fallbackValue) ? fallbackValue : 0;

    return `Rs. ${safeValue.toFixed(2)}`;
  }
}
