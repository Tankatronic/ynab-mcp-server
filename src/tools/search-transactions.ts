import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { resolveBudgetId } from "../ynab/types.js";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";
import { logger, startTimer } from "../utils/logger.js";

export function registerSearchTransactions(server: McpServer): void {
  server.tool(
    "search_transactions",
    "Search transactions with flexible filters (account, category, payee, date range, amount). Returns up to 100 results.",
    {
      budget_id: z.string().optional().describe("Budget ID. Omit for default."),
      account_id: z.string().optional().describe("Filter by account ID"),
      category_id: z.string().optional().describe("Filter by category ID"),
      payee_id: z.string().optional().describe("Filter by payee ID"),
      since_date: z
        .string()
        .optional()
        .describe("Only return transactions on or after this date (YYYY-MM-DD)"),
      type: z
        .enum(["uncategorized", "unapproved"])
        .optional()
        .describe("Filter by transaction status"),
      transaction_id: z
        .string()
        .optional()
        .describe("Get a single transaction by ID (ignores other filters)"),
      server_knowledge: z
        .number()
        .optional()
        .describe("Delta sync token from a previous response"),
    },
    async ({
      budget_id,
      account_id,
      category_id,
      payee_id,
      since_date,
      type,
      transaction_id,
      server_knowledge,
    }) => {
      const done = startTimer();
      logger.info("tool", "search_transactions invoked", { budget_id, account_id, category_id, payee_id, since_date, type, transaction_id: !!transaction_id });
      try {
        const ynab = getYnabClient();
        const id = resolveBudgetId(budget_id);

        // Single transaction lookup
        if (transaction_id) {
          const response = await ynab.transactions.getTransactionById(
            id,
            transaction_id,
          );
          const txn = response.data.transaction;
          const md =
            `## Transaction Detail\n\n` +
            `- **Date:** ${txn.date}\n` +
            `- **Payee:** ${txn.payee_name ?? "N/A"}\n` +
            `- **Amount:** ${milliunitsToDisplay(txn.amount)}\n` +
            `- **Category:** ${txn.category_name ?? "Uncategorized"}\n` +
            `- **Account:** ${txn.account_name}\n` +
            `- **Memo:** ${txn.memo ?? ""}\n` +
            `- **Cleared:** ${txn.cleared}\n` +
            `- **Approved:** ${txn.approved}\n`;

          done("tool", "search_transactions completed (single)", { transaction_id });
          return formatToolResponse(md, txn);
        }

        // Filtered list
        let transactions;
        let sk: number | undefined;

        if (account_id) {
          const resp = await ynab.transactions.getTransactionsByAccount(
            id,
            account_id,
            since_date,
            type,
            server_knowledge,
          );
          transactions = resp.data.transactions;
          sk = resp.data.server_knowledge;
        } else if (category_id) {
          const resp = await ynab.transactions.getTransactionsByCategory(
            id,
            category_id,
            since_date,
            type,
            server_knowledge,
          );
          transactions = resp.data.transactions;
          sk = resp.data.server_knowledge;
        } else if (payee_id) {
          const resp = await ynab.transactions.getTransactionsByPayee(
            id,
            payee_id,
            since_date,
            type,
            server_knowledge,
          );
          transactions = resp.data.transactions;
          sk = resp.data.server_knowledge;
        } else {
          const resp = await ynab.transactions.getTransactions(
            id,
            since_date,
            type,
            server_knowledge,
          );
          transactions = resp.data.transactions;
          sk = resp.data.server_knowledge;
        }

        const limited = transactions.slice(0, 100);
        const hasMore = transactions.length > 100;

        let md = `## Transactions (${limited.length}${hasMore ? ` of ${transactions.length}` : ""})\n\n`;
        md += `| Date | Payee | Amount | Category | Account |\n`;
        md += `|------|-------|--------|----------|---------|\n`;
        for (const txn of limited) {
          md += `| ${txn.date} | ${txn.payee_name ?? "N/A"} | ${milliunitsToDisplay(txn.amount)} | ${txn.category_name ?? ""} | ${txn.account_name} |\n`;
        }

        const data = {
          transactions: limited.map((t) => ({
            id: t.id,
            date: t.date,
            amount: t.amount,
            payee_id: t.payee_id,
            payee_name: t.payee_name,
            category_id: t.category_id,
            category_name: t.category_name,
            account_id: t.account_id,
            account_name: t.account_name,
            memo: t.memo,
            cleared: t.cleared,
            approved: t.approved,
            import_id: t.import_id,
            subtransactions: "subtransactions" in t ? t.subtransactions : undefined,
          })),
          total_count: transactions.length,
          has_more: hasMore,
          server_knowledge: sk,
        };

        done("tool", "search_transactions completed", { resultCount: limited.length, totalCount: transactions.length });
        return formatToolResponse(md, data);
      } catch (error) {
        logger.error("tool", "search_transactions failed", error);
        return formatError(error);
      }
    },
  );
}
