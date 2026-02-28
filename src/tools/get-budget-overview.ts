import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { resolveBudgetId } from "../ynab/types.js";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";
import { logger, startTimer } from "../utils/logger.js";

export function registerGetBudgetOverview(server: McpServer): void {
  server.tool(
    "get_budget_overview",
    "Get a summary of your budget including accounts, balances, and category group totals",
    {
      budget_id: z
        .string()
        .optional()
        .describe(
          "Budget ID. Omit to use the default (last used) budget.",
        ),
    },
    async ({ budget_id }) => {
      const done = startTimer();
      logger.info("tool", "get_budget_overview invoked", { budget_id });
      try {
        const ynab = getYnabClient();
        const id = resolveBudgetId(budget_id);
        const response = await ynab.budgets.getBudgetById(id);
        const budget = response.data.budget;

        const accounts = (budget.accounts ?? []).filter((a) => !a.deleted && !a.closed);
        const categoryGroups = (budget.category_groups ?? []).filter(
          (g) => !g.deleted && g.name !== "Internal Master Category",
        );

        let md = `## Budget Overview: ${budget.name}\n\n`;

        // Accounts summary
        md += `### Accounts (${accounts.length})\n\n`;
        md += `| Account | Type | Balance | Cleared |\n`;
        md += `|---------|------|---------|----------|\n`;
        for (const acct of accounts) {
          md += `| ${acct.name} | ${acct.type} | ${milliunitsToDisplay(acct.balance)} | ${milliunitsToDisplay(acct.cleared_balance)} |\n`;
        }

        // Category groups summary
        md += `\n### Category Groups\n\n`;
        md += `| Group | Budgeted | Activity | Balance |\n`;
        md += `|-------|----------|----------|---------|\n`;

        const categories = budget.categories ?? [];
        for (const group of categoryGroups) {
          const groupCats = categories.filter(
            (c) => c.category_group_id === group.id && !c.deleted && !c.hidden,
          );
          const budgeted = groupCats.reduce((s, c) => s + c.budgeted, 0);
          const activity = groupCats.reduce((s, c) => s + c.activity, 0);
          const balance = groupCats.reduce((s, c) => s + c.balance, 0);
          md += `| ${group.name} | ${milliunitsToDisplay(budgeted)} | ${milliunitsToDisplay(activity)} | ${milliunitsToDisplay(balance)} |\n`;
        }

        const data = {
          budget_id: budget.id,
          budget_name: budget.name,
          accounts: accounts.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            balance: a.balance,
            cleared_balance: a.cleared_balance,
            uncleared_balance: a.uncleared_balance,
            on_budget: a.on_budget,
          })),
          category_groups: categoryGroups.map((g) => ({
            id: g.id,
            name: g.name,
          })),
          server_knowledge: response.data.server_knowledge,
        };

        done("tool", "get_budget_overview completed", { accounts: accounts.length, categoryGroups: categoryGroups.length });
        return formatToolResponse(md, data);
      } catch (error) {
        logger.error("tool", "get_budget_overview failed", error);
        return formatError(error);
      }
    },
  );
}
