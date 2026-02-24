import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";

export function registerReconcileImport(server: McpServer): void {
  server.tool(
    "reconcile_import",
    "Verify import accuracy by comparing source file totals against import results. Flags any mismatches.",
    {
      source_transaction_count: z
        .number()
        .describe("Number of transactions in the source file"),
      source_total_amount: z
        .number()
        .describe("Sum of all amounts from the source file (in milliunits)"),
      imported_count: z
        .number()
        .describe("Number of transactions created by import_transactions"),
      duplicate_count: z
        .number()
        .describe("Number of duplicates skipped during import"),
      imported_total_amount: z
        .number()
        .describe(
          "Sum of imported transaction amounts (in milliunits). Use the same sum from import_transactions.",
        ),
    },
    async ({
      source_transaction_count,
      source_total_amount,
      imported_count,
      duplicate_count,
      imported_total_amount,
    }) => {
      const countMatch =
        source_transaction_count === imported_count + duplicate_count;
      const amountMatch = source_total_amount === imported_total_amount;
      const allGood = countMatch && amountMatch;

      let md = `## Reconciliation Report\n\n`;
      md += `### ${allGood ? "All checks passed" : "Mismatches detected"}\n\n`;

      md += `| Check | Source | Import | Status |\n`;
      md += `|-------|--------|--------|--------|\n`;
      md += `| Transaction count | ${source_transaction_count} | ${imported_count} created + ${duplicate_count} duplicates = ${imported_count + duplicate_count} | ${countMatch ? "MATCH" : "MISMATCH"} |\n`;
      md += `| Total amount | ${milliunitsToDisplay(source_total_amount)} | ${milliunitsToDisplay(imported_total_amount)} | ${amountMatch ? "MATCH" : "MISMATCH"} |\n`;

      if (!countMatch) {
        const diff =
          source_transaction_count - (imported_count + duplicate_count);
        md += `\n**Count mismatch:** ${Math.abs(diff)} transaction(s) ${diff > 0 ? "missing from import" : "extra in import"}. Check for skipped rows (bad dates, missing amounts) in the parse step.\n`;
      }

      if (!amountMatch) {
        const diff = source_total_amount - imported_total_amount;
        md += `\n**Amount mismatch:** Difference of ${milliunitsToDisplay(diff)}. This may indicate a parsing error or amount sign issue.\n`;
      }

      return formatToolResponse(md, {
        all_passed: allGood,
        count_match: countMatch,
        amount_match: amountMatch,
        source_transaction_count,
        source_total_amount,
        imported_count,
        duplicate_count,
        imported_total_amount,
      });
    },
  );
}
