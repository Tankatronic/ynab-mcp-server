import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { resolveBudgetId } from "../ynab/types.js";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";

export function registerUpdateTransaction(server: McpServer): void {
  server.tool(
    "update_transaction",
    "Update an existing transaction's fields, or delete it by setting flag_color to 'red' (YNAB convention). Only specified fields are changed.",
    {
      budget_id: z.string().optional().describe("Budget ID. Omit for default."),
      transaction_id: z.string().describe("ID of the transaction to update"),
      date: z.string().optional().describe("New date (YYYY-MM-DD)"),
      amount: z.number().optional().describe("New amount in milliunits"),
      payee_name: z.string().optional().describe("New payee name"),
      payee_id: z.string().optional().describe("New payee ID"),
      category_id: z.string().optional().describe("New category ID"),
      memo: z.string().optional().describe("New memo"),
      cleared: z
        .enum(["cleared", "uncleared", "reconciled"])
        .optional()
        .describe("New cleared status"),
      approved: z.boolean().optional().describe("New approval status"),
      flag_color: z
        .enum(["red", "orange", "yellow", "green", "blue", "purple", ""])
        .optional()
        .describe("Flag color. Use empty string to remove flag."),
    },
    async ({
      budget_id,
      transaction_id,
      date,
      amount,
      payee_name,
      payee_id,
      category_id,
      memo,
      cleared,
      approved,
      flag_color,
    }) => {
      try {
        const ynab = getYnabClient();
        const id = resolveBudgetId(budget_id);

        const updates: Record<string, unknown> = {};
        if (date !== undefined) updates.date = date;
        if (amount !== undefined) updates.amount = amount;
        if (payee_name !== undefined) updates.payee_name = payee_name;
        if (payee_id !== undefined) updates.payee_id = payee_id;
        if (category_id !== undefined) updates.category_id = category_id;
        if (memo !== undefined) updates.memo = memo;
        if (cleared !== undefined) updates.cleared = cleared;
        if (approved !== undefined) updates.approved = approved;
        if (flag_color !== undefined) updates.flag_color = flag_color;

        const response = await ynab.transactions.updateTransaction(
          id,
          transaction_id,
          { transaction: updates as any },
        );

        const updated = response.data.transaction;
        const md =
          `## Transaction Updated\n\n` +
          `- **ID:** ${updated.id}\n` +
          `- **Date:** ${updated.date}\n` +
          `- **Payee:** ${updated.payee_name ?? "N/A"}\n` +
          `- **Amount:** ${milliunitsToDisplay(updated.amount)}\n` +
          `- **Category:** ${updated.category_name ?? "Uncategorized"}\n` +
          `- **Account:** ${updated.account_name}\n` +
          `- **Cleared:** ${updated.cleared}\n`;

        return formatToolResponse(md, { transaction: updated });
      } catch (error) {
        return formatError(error);
      }
    },
  );
}
