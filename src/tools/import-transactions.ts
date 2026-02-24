import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { resolveBudgetId } from "../ynab/types.js";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";

const importTransactionSchema = z.object({
  date: z.string().describe("Transaction date YYYY-MM-DD"),
  amount: z.number().describe("Amount in milliunits"),
  payee_name: z.string().optional().describe("Payee name"),
  payee_id: z.string().optional().describe("YNAB payee ID if matched"),
  category_id: z.string().optional().describe("Category ID"),
  memo: z.string().optional().describe("Memo"),
  import_id: z.string().describe("Deterministic import ID for deduplication"),
  cleared: z
    .enum(["cleared", "uncleared", "reconciled"])
    .optional()
    .describe("Cleared status (default: cleared)"),
  subtransactions: z
    .array(
      z.object({
        amount: z.number().describe("Split amount in milliunits"),
        category_id: z.string().describe("Category ID for this split"),
        memo: z.string().optional().describe("Split memo"),
      }),
    )
    .optional()
    .describe("Split sub-transactions"),
});

export function registerImportTransactions(server: McpServer): void {
  server.tool(
    "import_transactions",
    "Bulk-import transactions into YNAB with deduplication via import_id. Supports split transactions.",
    {
      budget_id: z.string().optional().describe("Budget ID. Omit for default."),
      account_id: z.string().describe("Target YNAB account ID"),
      transactions: z
        .array(importTransactionSchema)
        .describe("Transactions to import"),
    },
    async ({ budget_id, account_id, transactions }) => {
      try {
        const ynab = getYnabClient();
        const id = resolveBudgetId(budget_id);

        const ynabTransactions = transactions.map((t) => ({
          account_id,
          date: t.date,
          amount: t.amount,
          payee_name: t.payee_name ?? undefined,
          payee_id: t.payee_id ?? undefined,
          category_id: t.category_id ?? undefined,
          memo: t.memo ?? undefined,
          import_id: t.import_id,
          cleared: (t.cleared ?? "cleared") as "cleared" | "uncleared" | "reconciled",
          approved: true,
          subtransactions: t.subtransactions?.map((s) => ({
            amount: s.amount,
            category_id: s.category_id,
            memo: s.memo ?? undefined,
          })),
        }));

        const response = await ynab.transactions.createTransaction(id, {
          transactions: ynabTransactions as any,
        });

        const data = response.data;
        const createdCount = data.transaction_ids?.length ?? 0;
        const duplicateCount = data.duplicate_import_ids?.length ?? 0;
        const totalAmount = transactions.reduce(
          (sum, t) => sum + t.amount,
          0,
        );

        let md = `## Import Complete\n\n`;
        md += `- **Created:** ${createdCount} transactions\n`;
        md += `- **Duplicates skipped:** ${duplicateCount}\n`;
        md += `- **Total amount:** ${milliunitsToDisplay(totalAmount)}\n`;

        if (duplicateCount > 0) {
          md += `\n### Skipped Duplicates\n`;
          md += `These transactions were already in YNAB (matched by import_id):\n`;
          for (const dupId of data.duplicate_import_ids ?? []) {
            md += `- \`${dupId}\`\n`;
          }
        }

        return formatToolResponse(md, {
          created_count: createdCount,
          duplicate_count: duplicateCount,
          total_submitted: transactions.length,
          total_amount: totalAmount,
          transaction_ids: data.transaction_ids,
          duplicate_import_ids: data.duplicate_import_ids,
          server_knowledge: data.server_knowledge,
        });
      } catch (error) {
        return formatError(error);
      }
    },
  );
}
