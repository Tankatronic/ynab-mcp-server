import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { resolveBudgetId } from "../ynab/types.js";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";
import { logger, startTimer } from "../utils/logger.js";

export function registerCreateTransaction(server: McpServer): void {
  server.tool(
    "create_transaction",
    "Create a single transaction in YNAB, optionally with split categories",
    {
      budget_id: z.string().optional().describe("Budget ID. Omit for default."),
      account_id: z.string().describe("Account ID to create the transaction in"),
      date: z.string().describe("Transaction date in YYYY-MM-DD format"),
      amount: z
        .number()
        .describe(
          "Amount in milliunits. Negative = outflow, positive = inflow. (e.g., -45670 for $45.67 spent)",
        ),
      payee_name: z
        .string()
        .optional()
        .describe("Payee name. YNAB will match to existing payees."),
      payee_id: z.string().optional().describe("Existing payee ID"),
      category_id: z
        .string()
        .optional()
        .describe("Category ID. Required unless using splits."),
      memo: z.string().optional().describe("Transaction memo"),
      cleared: z
        .enum(["cleared", "uncleared", "reconciled"])
        .optional()
        .describe("Cleared status (default: uncleared)"),
      approved: z
        .boolean()
        .optional()
        .describe("Whether to auto-approve (default: true)"),
      splits: z
        .array(
          z.object({
            amount: z.number().describe("Split amount in milliunits"),
            category_id: z.string().describe("Category ID for this split"),
            memo: z.string().optional().describe("Split memo"),
            payee_id: z.string().optional().describe("Split payee ID"),
          }),
        )
        .optional()
        .describe("Split transaction sub-transactions. Amounts must sum to the parent amount."),
    },
    async ({
      budget_id,
      account_id,
      date,
      amount,
      payee_name,
      payee_id,
      category_id,
      memo,
      cleared,
      approved,
      splits,
    }) => {
      const done = startTimer();
      logger.info("tool", "create_transaction invoked", { budget_id, account_id, date, payee_name, hasSplits: !!(splits && splits.length) });
      try {
        const ynab = getYnabClient();
        const id = resolveBudgetId(budget_id);

        const transaction: Record<string, unknown> = {
          account_id,
          date,
          amount,
          payee_name: payee_name ?? undefined,
          payee_id: payee_id ?? undefined,
          category_id: category_id ?? undefined,
          memo: memo ?? undefined,
          cleared: cleared ?? "uncleared",
          approved: approved ?? true,
        };

        if (splits && splits.length > 0) {
          transaction.subtransactions = splits.map((s) => ({
            amount: s.amount,
            category_id: s.category_id,
            memo: s.memo ?? undefined,
            payee_id: s.payee_id ?? undefined,
          }));
        }

        const response = await ynab.transactions.createTransaction(id, {
          transaction: transaction as any,
        });

        const created = response.data.transaction!;
        const md =
          `## Transaction Created\n\n` +
          `- **ID:** ${created.id}\n` +
          `- **Date:** ${created.date}\n` +
          `- **Payee:** ${created.payee_name ?? "N/A"}\n` +
          `- **Amount:** ${milliunitsToDisplay(created.amount)}\n` +
          `- **Category:** ${created.category_name ?? "Split"}\n` +
          `- **Account:** ${created.account_name}\n`;

        done("tool", "create_transaction completed", { transaction_id: created.id });
        return formatToolResponse(md, {
          transaction_id: created.id,
          transaction: created,
        });
      } catch (error) {
        logger.error("tool", "create_transaction failed", error);
        return formatError(error);
      }
    },
  );
}
