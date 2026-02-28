import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";
import { detectFormat, readFileContent } from "../parsers/detect-format.js";
import { parseCsvContent, type CsvColumnMapping } from "../parsers/csv-parser.js";
import { parseOfxContent } from "../parsers/ofx-parser.js";
import type { ParseResult } from "../parsers/types.js";
import { logger, startTimer } from "../utils/logger.js";

export function registerParseBankExport(server: McpServer): void {
  server.tool(
    "parse_bank_export",
    "Parse a bank export file (CSV, OFX, or QFX). Auto-detects format and known bank layouts. Returns parsed transactions ready for preview/import.",
    {
      file_path: z.string().describe("Absolute path to the bank export file"),
      format_hint: z
        .enum(["csv", "ofx", "qfx", "auto"])
        .optional()
        .describe("File format hint. Usually auto-detected."),
      date_format_hint: z
        .enum(["MM/DD/YYYY", "DD/MM/YYYY", "auto"])
        .optional()
        .describe("Date format hint for CSV files. Default: auto"),
      column_mapping: z
        .object({
          date: z.string().describe("Column name for transaction date"),
          payee: z.string().describe("Column name for payee/description"),
          amount: z.string().optional().describe("Column name for amount"),
          debit: z
            .string()
            .optional()
            .describe("Column name for debit amount (if separate from credit)"),
          credit: z
            .string()
            .optional()
            .describe("Column name for credit amount (if separate from debit)"),
          memo: z.string().optional().describe("Column name for memo"),
        })
        .optional()
        .describe("Custom column mapping for CSV files. Usually auto-detected."),
      invert_amounts: z
        .boolean()
        .optional()
        .describe("Flip the sign of all amounts. Some banks use opposite conventions."),
    },
    async ({
      file_path,
      format_hint,
      date_format_hint,
      column_mapping,
      invert_amounts,
    }) => {
      const done = startTimer();
      logger.info("tool", "parse_bank_export invoked", { file_path, format_hint });
      try {
        const format =
          format_hint && format_hint !== "auto"
            ? format_hint
            : await detectFormat(file_path);

        if (format === "unknown") {
          logger.warn("tool", "parse_bank_export: unsupported format", { file_path });
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: "UNSUPPORTED_FORMAT",
                  message: `Could not detect file format for: ${file_path}. Supported formats: CSV, OFX, QFX.`,
                  retryable: false,
                }),
              },
            ],
          } as const;
        }

        const content = await readFileContent(file_path);
        let result: ParseResult;

        if (format === "csv") {
          result = parseCsvContent(content, {
            columnMapping: column_mapping as CsvColumnMapping | undefined,
            dateFormatHint: date_format_hint,
            invertAmounts: invert_amounts,
          });
        } else {
          result = await parseOfxContent(content, format);
        }

        const totalAmount = result.transactions.reduce(
          (sum, t) => sum + t.amount,
          0,
        );

        let md = `## Parsed Bank Export\n\n`;
        md += `- **Format:** ${result.format.toUpperCase()}\n`;
        md += `- **Transactions:** ${result.transactions.length}\n`;
        md += `- **Total:** ${milliunitsToDisplay(totalAmount)}\n`;
        if (result.accountName) {
          md += `- **Account:** ${result.accountName}\n`;
        }

        if (result.warnings.length > 0) {
          md += `\n### Warnings\n`;
          for (const w of result.warnings) {
            md += `- ${w}\n`;
          }
        }

        md += `\n### Transactions\n\n`;
        md += `| Date | Payee | Amount | Import ID |\n`;
        md += `|------|-------|--------|----------|\n`;
        for (const t of result.transactions.slice(0, 50)) {
          md += `| ${t.date} | ${t.payee} | ${milliunitsToDisplay(t.amount)} | ${t.importId.slice(0, 20)}... |\n`;
        }
        if (result.transactions.length > 50) {
          md += `\n_...and ${result.transactions.length - 50} more transactions_\n`;
        }

        done("tool", "parse_bank_export completed", { format: result.format, transactionCount: result.transactions.length, warnings: result.warnings.length });
        return formatToolResponse(md, {
          format: result.format,
          transaction_count: result.transactions.length,
          total_amount: totalAmount,
          account_name: result.accountName,
          transactions: result.transactions,
          warnings: result.warnings,
        });
      } catch (error) {
        logger.error("tool", "parse_bank_export failed", error);
        return formatError(error);
      }
    },
  );
}
