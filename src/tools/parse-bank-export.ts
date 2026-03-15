import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { milliunitsToDisplay } from "../utils/milliunit.js";
import { detectFormat, readFileContent } from "../parsers/detect-format.js";
import { parseCsvContent, type CsvColumnMapping } from "../parsers/csv-parser.js";
import { parseOfxContent } from "../parsers/ofx-parser.js";
import { parseJsonContent } from "../parsers/json-parser.js";
import type { ParseResult } from "../parsers/types.js";
import { logger, startTimer } from "../utils/logger.js";

const CONTENT_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

export function registerParseBankExport(server: McpServer): void {
  server.tool(
    "parse_bank_export",
    "Parse a bank export file (CSV, OFX, QFX, or JSON). Auto-detects format and known bank layouts. Returns parsed transactions ready for preview/import.",
    {
      file_path: z.string().optional().describe("Absolute path to the bank export file"),
      content: z.string().optional().describe("Raw file content as a string (alternative to file_path)"),
      format_hint: z
        .enum(["csv", "ofx", "qfx", "json", "auto"])
        .optional()
        .describe("File format hint. Usually auto-detected. Required when using content parameter."),
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
      content,
      format_hint,
      date_format_hint,
      column_mapping,
      invert_amounts,
    }) => {
      const done = startTimer();
      logger.info("tool", "parse_bank_export invoked", { file_path: !!file_path, content: !!content, format_hint });
      try {
        // Validation: exactly one of file_path or content must be provided
        if (!file_path && !content) {
          logger.warn("tool", "parse_bank_export: neither file_path nor content provided");
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: "INVALID_INPUT",
                  message: "Either file_path or content is required",
                  retryable: false,
                }),
              },
            ],
          } as const;
        }

        if (file_path && content) {
          logger.warn("tool", "parse_bank_export: both file_path and content provided");
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: "INVALID_INPUT",
                  message: "Provide either file_path or content, not both",
                  retryable: false,
                }),
              },
            ],
          } as const;
        }

        // When content is provided, format_hint is required (and cannot be "auto")
        if (content && (!format_hint || format_hint === "auto")) {
          logger.warn("tool", "parse_bank_export: content provided without valid format_hint");
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: "INVALID_INPUT",
                  message: "format_hint is required when using content (csv, ofx, qfx, or json)",
                  retryable: false,
                }),
              },
            ],
          } as const;
        }

        // Validate content size
        if (content && content.length > CONTENT_SIZE_LIMIT) {
          logger.warn("tool", "parse_bank_export: content exceeds size limit", { size: content.length });
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: "CONTENT_TOO_LARGE",
                  message: "Content exceeds 5MB limit",
                  retryable: false,
                }),
              },
            ],
          } as const;
        }

        let format: string;
        let fileContent: string;

        if (content) {
          format = format_hint!;
          fileContent = content;
        } else {
          format =
            format_hint && format_hint !== "auto"
              ? format_hint
              : await detectFormat(file_path!);
          fileContent = await readFileContent(file_path!);
        }

        if (format === "unknown") {
          logger.warn("tool", "parse_bank_export: unsupported format", { file_path });
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: "UNSUPPORTED_FORMAT",
                  message: `Could not detect file format for: ${file_path}. Supported formats: CSV, OFX, QFX, JSON.`,
                  retryable: false,
                }),
              },
            ],
          } as const;
        }

        let result: ParseResult;

        if (format === "csv") {
          result = parseCsvContent(fileContent, {
            columnMapping: column_mapping as CsvColumnMapping | undefined,
            dateFormatHint: date_format_hint,
            invertAmounts: invert_amounts,
          });
        } else if (format === "json") {
          result = parseJsonContent(fileContent, {
            dateFormatHint: date_format_hint,
          });
        } else {
          result = await parseOfxContent(fileContent, format as "ofx" | "qfx");
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
