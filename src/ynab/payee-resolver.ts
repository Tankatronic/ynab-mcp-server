/**
 * Smart payee resolution for transfer transactions.
 *
 * When a user provides an account name as the payee (e.g. "Schwab Checking"),
 * YNAB creates a generic inflow instead of a proper transfer. This module
 * detects that pattern and resolves the correct transfer payee_id automatically.
 */
import type * as ynab from "ynab";
import { logger } from "../utils/logger.js";

interface PayeeCache {
  payees: ynab.Payee[];
  fetchedAt: number;
}

// Cache per budget, TTL = 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;
const payeeCache = new Map<string, PayeeCache>();

async function getPayees(api: ynab.API, budgetId: string): Promise<ynab.Payee[]> {
  // Skip cache for "last-used" sentinel: YNAB resolves it to whichever budget was
  // last active, which can change between calls. Caching under the sentinel would
  // return stale payees from a different budget if the user switches budgets.
  const isSentinel = budgetId === "last-used";

  if (!isSentinel) {
    const cached = payeeCache.get(budgetId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      logger.debug("payee-resolver", "Using cached payees", { budgetId, count: cached.payees.length });
      return cached.payees;
    }
  }

  logger.info("payee-resolver", "Fetching payees from YNAB API", { budgetId });
  const response = await api.payees.getPayees(budgetId);
  const payees = response.data.payees;

  if (!isSentinel) {
    payeeCache.set(budgetId, { payees, fetchedAt: Date.now() });
  }

  return payees;
}

/**
 * Normalize a name for matching: lowercase, trim, strip "Transfer : " prefix.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/^transfer\s*:\s*/i, "");
}

export interface TransferPayeeMatch {
  payee_id: string;
  payee_name: string;
}

export interface TransferPayeeAmbiguous {
  error: string;
  matches: string[];
}

/**
 * Attempt to resolve a payee name to a YNAB transfer payee ID.
 *
 * Returns:
 *   - TransferPayeeMatch if exactly one transfer payee matches the name
 *   - TransferPayeeAmbiguous if multiple payees match
 *   - null if no transfer payee matches (use payee_name as-is)
 */
export async function resolveTransferPayee(
  api: ynab.API,
  budgetId: string,
  payeeName: string,
): Promise<TransferPayeeMatch | TransferPayeeAmbiguous | null> {
  const payees = await getPayees(api, budgetId);

  // Transfer payees in YNAB are named "Transfer : <Account Name>"
  // Exclude deleted payees — YNAB returns them in the list but they're no longer valid.
  const transferPayees = payees.filter(
    (p) => p.transfer_account_id != null && !p.deleted,
  );

  const normalizedInput = normalizeName(payeeName);
  const matches = transferPayees.filter(
    (p) => normalizeName(p.name) === normalizedInput,
  );

  if (matches.length === 0) {
    logger.debug("payee-resolver", "No transfer payee match found", { payeeName });
    return null;
  }

  if (matches.length > 1) {
    logger.warn("payee-resolver", "Ambiguous transfer payee match", { payeeName, matches: matches.map((m) => m.name) });
    return {
      error: `Ambiguous payee "${payeeName}" matches multiple transfer accounts. Please use payee_id directly.`,
      matches: matches.map((m) => m.name),
    };
  }

  const match = matches[0];
  logger.info("payee-resolver", "Resolved transfer payee", { payeeName, resolvedId: match.id, resolvedName: match.name });
  return { payee_id: match.id, payee_name: match.name };
}

/** Clear cached payees for a budget (e.g. after account changes). */
export function clearPayeeCache(budgetId?: string): void {
  if (budgetId) {
    payeeCache.delete(budgetId);
  } else {
    payeeCache.clear();
  }
}
