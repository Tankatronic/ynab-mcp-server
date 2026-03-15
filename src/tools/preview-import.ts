import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { resolveBudgetId } from "../ynab/types.js";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";
import { logger, startTimer } from "../utils/logger.js";

const parsedTransactionSchema = z.object({
  date: z.string(),
  amount: z.number(),
  payee: z.string(),
  memo: z.string(),
  importId: z.string(),
});

export function registerPreviewImport(server: McpServer): void {
  server.tool(
    "preview_import",
    "Preview parsed transactions with AI-suggested categories based on your YNAB history. Returns a dry-run summary before importing.",
    {
      budget_id: z.string().optional().describe("Budget ID. Omit for default."),
      account_id: z
        .string()
        .describe("Target YNAB account ID for the import"),
      transactions: z
        .array(parsedTransactionSchema)
        .describe("Parsed transactions from parse_bank_export"),
      since_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
        .optional()
        .describe("Only include transactions on or after this date (YYYY-MM-DD format)"),
    },
    async ({ budget_id, account_id, transactions, since_date }) => {
      const done = startTimer();
      logger.info("tool", "preview_import invoked", { budget_id, account_id, transactionCount: transactions.length, since_date });
      try {
        const ynab = getYnabClient();
        const id = resolveBudgetId(budget_id);

        // Filter transactions by since_date if provided
        let filteredTransactions = transactions;
        let filteredCount = 0;
        if (since_date) {
          filteredTransactions = transactions.filter((t) => t.date >= since_date);
          filteredCount = transactions.length - filteredTransactions.length;
        }

        // Fetch recent transactions for this account to build payee-to-category map
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const sinceDate = threeMonthsAgo.toISOString().split("T")[0];

        const historyResp =
          await ynab.transactions.getTransactionsByAccount(
            id,
            account_id,
            sinceDate,
          );
        const history = historyResp.data.transactions;

        // Build payee-to-category mapping from history (regular transactions only)
        const payeeCategoryMap = new Map<
          string,
          { category_id: string; category_name: string; count: number }
        >();

        // Build transfer payee map from history: keyed by payee_id so each unique
        // source account is represented once. Used to detect CC payment transactions.
        const historicalTransferPayees = new Map<
          string,
          { payee_id: string; payee_name: string }
        >();

        for (const txn of history) {
          if (!txn.payee_name) continue;

          if (txn.transfer_account_id && txn.payee_id) {
            // Transfer (e.g. CC payment from Schwab Checking): track payee_id separately
            historicalTransferPayees.set(txn.payee_id, {
              payee_id: txn.payee_id,
              payee_name: txn.payee_name,
            });
            continue;
          }

          if (!txn.category_id) continue;

          const normalized = txn.payee_name.toLowerCase().trim();
          const existing = payeeCategoryMap.get(normalized);
          if (!existing || txn.date > (existing as any).lastDate) {
            payeeCategoryMap.set(normalized, {
              category_id: txn.category_id,
              category_name: txn.category_name || "",
              count: (existing?.count ?? 0) + 1,
            });
          }
        }

        const transferPayeeList = Array.from(historicalTransferPayees.values());

        // Patterns that indicate an autopay / CC payment on a credit card statement.
        // These are distinct enough to be credit-card-payment specific.
        const CC_PAYMENT_PATTERNS =
          [/\bautopay\b/i, /\bauto[- ]?pmt\b/i, /\bauto[- ]?pay\b/i];

        // Also fetch payees for name matching
        const payeesResp = await ynab.payees.getPayees(id);
        const ynabPayees = payeesResp.data.payees.filter((p) => !p.deleted);

        // Match each transaction
        const previews = filteredTransactions.map((txn) => {
          const normalizedPayee = txn.payee.toLowerCase().trim();

          // Check if this looks like a CC payment / autopay entry
          const isCCPayment = CC_PAYMENT_PATTERNS.some((p) =>
            p.test(txn.payee),
          );

          if (isCCPayment && transferPayeeList.length > 0) {
            // If history shows exactly one source account, we can resolve automatically.
            // If multiple accounts exist the agent must choose.
            const resolved =
              transferPayeeList.length === 1 ? transferPayeeList[0] : null;
            return {
              ...txn,
              is_transfer: true,
              suggested_category_id: null,
              suggested_category_name:
                resolved
                  ? `CC Payment → ${resolved.payee_name.replace(/^Transfer\s*:\s*/i, "")}`
                  : "CC Payment (multiple source accounts — choose payee_id)",
              category_match_confidence: resolved ? "transfer" : "transfer-ambiguous",
              matched_payee_id: resolved?.payee_id ?? null,
              matched_payee_name: resolved?.payee_name ?? null,
            };
          }

          // Try exact match first
          let suggestion = payeeCategoryMap.get(normalizedPayee);

          // Try partial match if no exact match
          if (!suggestion) {
            for (const [key, val] of payeeCategoryMap) {
              if (
                normalizedPayee.includes(key) ||
                key.includes(normalizedPayee)
              ) {
                suggestion = val;
                break;
              }
            }
          }

          // Try to match against YNAB payee names
          const matchedPayee = ynabPayees.find(
            (p) =>
              p.name.toLowerCase() === normalizedPayee ||
              normalizedPayee.includes(p.name.toLowerCase()),
          );

          return {
            ...txn,
            is_transfer: false,
            suggested_category_id: suggestion?.category_id ?? null,
            suggested_category_name: suggestion?.category_name ?? null,
            category_match_confidence: suggestion
              ? suggestion.count >= 3
                ? "high"
                : "medium"
              : "none",
            matched_payee_id: matchedPayee?.id ?? null,
            matched_payee_name: matchedPayee?.name ?? null,
          };
        });

        const transfers = previews.filter((p) => p.is_transfer).length;
        const matched = previews.filter((p) => !p.is_transfer && p.suggested_category_id).length;
        const unmatched = previews.length - transfers - matched;
        const totalAmount = filteredTransactions.reduce(
          (sum, t) => sum + t.amount,
          0,
        );

        let md = `## Import Preview\n\n`;
        md += `- **Transactions:** ${filteredTransactions.length}\n`;
        if (filteredCount > 0) {
          md += `- **Filtered:** ${filteredCount} (before ${since_date})\n`;
        }
        md += `- **Total:** ${milliunitsToDisplay(totalAmount)}\n`;
        md += `- **Transfers (CC payments):** ${transfers}\n`;
        const categorizedPercent = filteredTransactions.length > 0
          ? Math.round((matched / filteredTransactions.length) * 100)
          : 0;
        md += `- **Categorized:** ${matched} (${categorizedPercent}%)\n`;
        md += `- **Uncategorized:** ${unmatched}\n\n`;

        md += `| Date | Payee | Amount | Suggested Category | Confidence |\n`;
        md += `|------|-------|--------|--------------------|------------|\n`;
        for (const p of previews) {
          md += `| ${p.date} | ${p.payee} | ${milliunitsToDisplay(p.amount)} | ${p.suggested_category_name ?? "_none_"} | ${p.category_match_confidence} |\n`;
        }

        done("tool", "preview_import completed", { total: filteredTransactions.length, filtered: filteredCount, transfers, categorized: matched, uncategorized: unmatched });
        return formatToolResponse(md, {
          account_id,
          total_count: filteredTransactions.length,
          filtered_count: filteredCount,
          total_amount: totalAmount,
          transfer_count: transfers,
          categorized_count: matched,
          uncategorized_count: unmatched,
          previews,
        });
      } catch (error) {
        logger.error("tool", "preview_import failed", error);

        // Extract actual error details
        let errorMessage = "Unknown error";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "object" && error !== null) {
          errorMessage = JSON.stringify(error, null, 2);
        }

        return formatError(new Error(`Preview failed: ${errorMessage}`));
      }
    },
  );
}
