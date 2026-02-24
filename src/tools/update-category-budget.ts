import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { resolveBudgetId } from "../ynab/types.js";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";

export function registerUpdateCategoryBudget(server: McpServer): void {
  server.tool(
    "update_category_budget",
    "Update the budgeted amount for a category in a specific month",
    {
      budget_id: z.string().optional().describe("Budget ID. Omit for default."),
      category_id: z.string().describe("Category ID to update"),
      month: z
        .string()
        .describe("Month in YYYY-MM-DD format (day must be 01)"),
      budgeted: z
        .number()
        .describe(
          "New budgeted amount in milliunits (e.g., 500000 for $500.00)",
        ),
    },
    async ({ budget_id, category_id, month, budgeted }) => {
      try {
        const ynab = getYnabClient();
        const id = resolveBudgetId(budget_id);

        const response = await ynab.categories.updateMonthCategory(
          id,
          month,
          category_id,
          { category: { budgeted } },
        );

        const cat = response.data.category;
        const md =
          `## Category Budget Updated\n\n` +
          `- **Category:** ${cat.name}\n` +
          `- **Month:** ${month.slice(0, 7)}\n` +
          `- **Budgeted:** ${milliunitsToDisplay(cat.budgeted)}\n` +
          `- **Activity:** ${milliunitsToDisplay(cat.activity)}\n` +
          `- **Balance:** ${milliunitsToDisplay(cat.balance)}\n`;

        return formatToolResponse(md, {
          category_id: cat.id,
          name: cat.name,
          budgeted: cat.budgeted,
          activity: cat.activity,
          balance: cat.balance,
        });
      } catch (error) {
        return formatError(error);
      }
    },
  );
}
