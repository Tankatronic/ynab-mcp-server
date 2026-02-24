import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { resolveBudgetId } from "../ynab/types.js";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";

export function registerGetMonthlyTrends(server: McpServer): void {
  server.tool(
    "get_monthly_trends",
    "Compare budget performance across months: income, spending, category-level trends, and underspent/overspent categories",
    {
      budget_id: z.string().optional().describe("Budget ID. Omit for default."),
      num_months: z
        .number()
        .min(2)
        .max(12)
        .optional()
        .describe("Number of recent months to compare (default: 3, max: 12)"),
    },
    async ({ budget_id, num_months }) => {
      try {
        const ynab = getYnabClient();
        const id = resolveBudgetId(budget_id);
        const count = num_months ?? 3;

        const monthsResponse = await ynab.months.getBudgetMonths(id);
        const allMonths = monthsResponse.data.months
          .filter((m) => !m.deleted)
          .sort((a, b) => b.month.localeCompare(a.month));

        const recentMonths = allMonths.slice(0, count);

        // Fetch detail for each month
        const monthDetails = await Promise.all(
          recentMonths.map((m) =>
            ynab.months.getBudgetMonth(id, m.month),
          ),
        );

        let md = `## Monthly Trends (${count} months)\n\n`;
        md += `| Month | Income | Budgeted | Activity | To Be Budgeted |\n`;
        md += `|-------|--------|----------|----------|-----------------|\n`;

        const monthSummaries = monthDetails.map((resp) => {
          const m = resp.data.month;
          return {
            month: m.month,
            income: m.income,
            budgeted: m.budgeted,
            activity: m.activity,
            to_be_budgeted: m.to_be_budgeted,
            categories: (m.categories ?? [])
              .filter((c) => !c.deleted && !c.hidden)
              .map((c) => ({
                id: c.id,
                name: c.name,
                category_group_name: c.category_group_name,
                budgeted: c.budgeted,
                activity: c.activity,
                balance: c.balance,
              })),
          };
        });

        for (const m of monthSummaries) {
          md += `| ${m.month.slice(0, 7)} | ${milliunitsToDisplay(m.income)} | ${milliunitsToDisplay(m.budgeted)} | ${milliunitsToDisplay(m.activity)} | ${milliunitsToDisplay(m.to_be_budgeted)} |\n`;
        }

        // Identify consistently overspent/underspent categories
        if (monthSummaries.length >= 2) {
          const categoryMap = new Map<
            string,
            { name: string; group: string; balances: number[] }
          >();

          for (const m of monthSummaries) {
            for (const c of m.categories) {
              if (!categoryMap.has(c.id)) {
                categoryMap.set(c.id, {
                  name: c.name,
                  group: c.category_group_name ?? "",
                  balances: [],
                });
              }
              categoryMap.get(c.id)!.balances.push(c.balance);
            }
          }

          const overspent = [...categoryMap.values()].filter(
            (c) =>
              c.balances.length >= 2 && c.balances.every((b) => b < 0),
          );
          const underspent = [...categoryMap.values()].filter(
            (c) =>
              c.balances.length >= 2 &&
              c.balances.every((b) => b > 0) &&
              c.balances.every((b) => b > 10000), // > $10 consistently
          );

          if (overspent.length > 0) {
            md += `\n### Consistently Overspent\n\n`;
            for (const c of overspent) {
              md += `- **${c.name}** (${c.group}): ${c.balances.map(milliunitsToDisplay).join(", ")}\n`;
            }
          }

          if (underspent.length > 0) {
            md += `\n### Consistently Underspent (>${milliunitsToDisplay(10000)}/mo)\n\n`;
            for (const c of underspent) {
              md += `- **${c.name}** (${c.group}): ${c.balances.map(milliunitsToDisplay).join(", ")}\n`;
            }
          }
        }

        return formatToolResponse(md, { months: monthSummaries });
      } catch (error) {
        return formatError(error);
      }
    },
  );
}
