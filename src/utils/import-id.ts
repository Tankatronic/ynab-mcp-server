import { createHash } from "node:crypto";

/**
 * Generate a deterministic import_id for YNAB transaction deduplication.
 * Same inputs always produce the same ID, enabling safe re-imports.
 *
 * @param date - Transaction date in YYYY-MM-DD format
 * @param amount - Amount in milliunits
 * @param payee - Raw payee string from bank export
 * @param occurrence - 0-indexed occurrence for same date+amount+payee combos
 */
export function generateImportId(
  date: string,
  amount: number,
  payee: string,
  occurrence: number,
): string {
  const input = `${date}:${amount}:${payee}:${occurrence}`;
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 16);
  return `YNAB-MCP:${hash}`;
}
