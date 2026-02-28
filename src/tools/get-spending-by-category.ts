import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { resolveBudgetId } from "../ynab/types.js";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";
import { logger, startTimer } from "../utils/logger.js";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function registerGetSpendingByCategory(server: McpServer): void {
  server.tool(
    "get_spending_by_category",
    "Get spending breakdown by category for a specific month, including budgeted vs actual",
    {
      budget_id: z.string().optional().describe("Budget ID. Omit for default."),
      month: z
        .string()
        .optional()
        .describe(
          "Month in YYYY-MM-DD format (day must be 01). Defaults to current month.",
        ),
    },
    async ({ budget_id, month }) => {
      const done = startTimer();
      logger.info("tool", "get_spending_by_category invoked", { budget_id, month });
      try {
        const ynab = getYnabClient();
        const id = resolveBudgetId(budget_id);
        const targetMonth = month ?? getCurrentMonth();

        const monthResponse = await ynab.months.getBudgetMonth(
          id,
          targetMonth,
        );
        const monthData = monthResponse.data.month;
        const categories = monthData.categories ?? [];

        // Group by category group
        const grouped = new Map<
          string,
          Array<{ name: string; budgeted: number; activity: number; balance: number }>
        >();

        for (const cat of categories) {
          if (cat.deleted || cat.hidden) continue;
          const groupName = cat.category_group_name ?? "Other";
          if (groupName === "Internal Master Category") continue;

          if (!grouped.has(groupName)) {
            grouped.set(groupName, []);
          }
          grouped.get(groupName)!.push({
            name: cat.name,
            budgeted: cat.budgeted,
            activity: cat.activity,
            balance: cat.balance,
          });
        }

        let md = `## Spending by Category: ${targetMonth.slice(0, 7)}\n\n`;

        for (const [groupName, cats] of grouped) {
          md += `### ${groupName}\n\n`;
          md += `| Category | Budgeted | Spent | Balance |\n`;
          md += `|----------|----------|-------|---------|\n`;
          for (const cat of cats) {
            const spent = -cat.activity; // activity is negative for spending
            md += `| ${cat.name} | ${milliunitsToDisplay(cat.budgeted)} | ${milliunitsToDisplay(spent)} | ${milliunitsToDisplay(cat.balance)} |\n`;
          }
          md += `\n`;
        }

        const data = {
          month: targetMonth,
          categories: categories
            .filter((c) => !c.deleted && !c.hidden)
            .map((c) => ({
              id: c.id,
              name: c.name,
              category_group_id: c.category_group_id,
              category_group_name: c.category_group_name,
              budgeted: c.budgeted,
              activity: c.activity,
              balance: c.balance,
              goal_type: c.goal_type,
              goal_target: c.goal_target,
              goal_percentage_complete: c.goal_percentage_complete,
            })),
        };

        done("tool", "get_spending_by_category completed", { month: targetMonth, categoryCount: data.categories.length });
        return formatToolResponse(md, data);
      } catch (error) {
        logger.error("tool", "get_spending_by_category failed", error);
        return formatError(error);
      }
    },
  );
}
