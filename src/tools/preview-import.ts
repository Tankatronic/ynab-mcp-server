import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { resolveBudgetId } from "../ynab/types.js";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";

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
    },
    async ({ budget_id, account_id, transactions }) => {
      try {
        const ynab = getYnabClient();
        const id = resolveBudgetId(budget_id);

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

        // Build payee-to-category mapping from history
        const payeeCategoryMap = new Map<
          string,
          { category_id: string; category_name: string; count: number }
        >();

        for (const txn of history) {
          if (!txn.payee_name || !txn.category_id || !txn.category_name) {
            continue;
          }
          const normalized = txn.payee_name.toLowerCase().trim();
          const existing = payeeCategoryMap.get(normalized);
          if (!existing || txn.date > (existing as any).lastDate) {
            payeeCategoryMap.set(normalized, {
              category_id: txn.category_id,
              category_name: txn.category_name,
              count: (existing?.count ?? 0) + 1,
            });
          }
        }

        // Also fetch payees for name matching
        const payeesResp = await ynab.payees.getPayees(id);
        const ynabPayees = payeesResp.data.payees.filter((p) => !p.deleted);

        // Match each transaction
        const previews = transactions.map((txn) => {
          const normalizedPayee = txn.payee.toLowerCase().trim();

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

        const matched = previews.filter((p) => p.suggested_category_id).length;
        const unmatched = previews.length - matched;
        const totalAmount = transactions.reduce(
          (sum, t) => sum + t.amount,
          0,
        );

        let md = `## Import Preview\n\n`;
        md += `- **Transactions:** ${transactions.length}\n`;
        md += `- **Total:** ${milliunitsToDisplay(totalAmount)}\n`;
        md += `- **Categorized:** ${matched} (${Math.round((matched / transactions.length) * 100)}%)\n`;
        md += `- **Uncategorized:** ${unmatched}\n\n`;

        md += `| Date | Payee | Amount | Suggested Category | Confidence |\n`;
        md += `|------|-------|--------|--------------------|------------|\n`;
        for (const p of previews) {
          md += `| ${p.date} | ${p.payee} | ${milliunitsToDisplay(p.amount)} | ${p.suggested_category_name ?? "_none_"} | ${p.category_match_confidence} |\n`;
        }

        return formatToolResponse(md, {
          total_count: transactions.length,
          total_amount: totalAmount,
          categorized_count: matched,
          uncategorized_count: unmatched,
          previews,
        });
      } catch (error) {
        return formatError(error);
      }
    },
  );
}
