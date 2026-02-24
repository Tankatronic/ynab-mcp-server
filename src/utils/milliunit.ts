/**
 * Milliunit conversion utilities.
 * YNAB uses milliunits (1 dollar = 1000 milliunits).
 * All conversions use integer arithmetic to avoid floating point errors.
 */

export function dollarsToMilliunits(dollars: string): number {
  const cleaned = dollars.replace(/[$,\s]/g, "");
  const negative = cleaned.startsWith("-") || cleaned.startsWith("(");
  const abs = cleaned.replace(/[()-]/g, "");

  const parts = abs.split(".");
  const whole = parseInt(parts[0] || "0", 10);
  const decimalStr = (parts[1] || "").padEnd(3, "0").slice(0, 3);
  const decimal = parseInt(decimalStr, 10);

  const milliunits = whole * 1000 + decimal;
  return negative ? -milliunits : milliunits;
}

export function milliunitsToDisplay(milliunits: number): string {
  const negative = milliunits < 0;
  const abs = Math.abs(milliunits);
  const whole = Math.floor(abs / 1000);
  const frac = abs % 1000;
  const decimal = Math.floor(frac / 10)
    .toString()
    .padStart(2, "0");
  return `${negative ? "-" : ""}$${whole.toLocaleString()}.${decimal}`;
}

export function formatAmount(milliunits: number): string {
  return `${milliunits} (${milliunitsToDisplay(milliunits)})`;
}
