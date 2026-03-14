import { ParseError } from "../utils/errors.js";
import { dollarsToMilliunits } from "../utils/milliunit.js";
import { parseDate, type DateFormatHint } from "../utils/date-parser.js";
import { generateImportId } from "../utils/import-id.js";
import type { ParsedTransaction, ParseResult } from "./types.js";

/**
 * JSON transaction object with flexible field mapping.
 * Expected schema: array of objects with date, amount, payee, memo fields.
 */
interface JsonTransaction {
  date?: string;
  amount?: number | string;
  payee?: string;
  memo?: string;
  [key: string]: unknown;
}

export interface JsonParseOptions {
  dateFormatHint?: DateFormatHint;
}

/**
 * Parse JSON content into transactions.
 * Expects an array of objects with date, amount, payee, memo fields.
 *
 * @param content - JSON string content
 * @param options - Parse options
 * @returns ParseResult with parsed transactions
 */
export function parseJsonContent(
  content: string,
  options: JsonParseOptions = {},
): ParseResult {
  if (!content.trim()) {
    throw new ParseError("JSON file is empty");
  }

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (err) {
    throw new ParseError(
      `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Ensure data is an array
  let transactions_raw: unknown[];
  if (!Array.isArray(data)) {
    // If not an array, try wrapping single object
    if (
      typeof data === "object" &&
      data !== null &&
      !Array.isArray(data) &&
      "transactions" in data
    ) {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.transactions)) {
        transactions_raw = obj.transactions;
      } else {
        throw new ParseError(
          "JSON must be an array of transactions or an object with a 'transactions' array",
        );
      }
    } else {
      throw new ParseError(
        "JSON must be an array of transactions or an object with a 'transactions' array",
      );
    }
  } else {
    transactions_raw = data;
  }

  if (transactions_raw.length === 0) {
    throw new ParseError("JSON file contains no transactions");
  }

  const dateHint = options.dateFormatHint ?? "auto";
  const transactions: ParsedTransaction[] = [];
  const warnings: string[] = [];
  const occurrenceMap = new Map<string, number>();

  for (let i = 0; i < transactions_raw.length; i++) {
    const row = transactions_raw[i] as JsonTransaction;
    const lineNum = i + 1;

    if (typeof row !== "object" || row === null) {
      warnings.push(`Row ${lineNum}: not an object, skipping`);
      continue;
    }

    // Extract date
    const rawDate = row.date;
    if (!rawDate) {
      warnings.push(`Row ${lineNum}: missing date, skipping`);
      continue;
    }
    const date = parseDate(String(rawDate), dateHint);
    if (!date) {
      warnings.push(
        `Row ${lineNum}: could not parse date "${rawDate}", skipping`,
      );
      continue;
    }

    // Extract amount
    let amountStr: string | undefined;
    if (row.amount !== undefined && row.amount !== null) {
      amountStr = String(row.amount);
    }

    if (!amountStr || amountStr.trim() === "") {
      warnings.push(`Row ${lineNum}: missing amount, skipping`);
      continue;
    }

    let amount: number;
    try {
      amount = dollarsToMilliunits(amountStr);
      if (Number.isNaN(amount)) {
        warnings.push(
          `Row ${lineNum}: invalid amount "${amountStr}", skipping`,
        );
        continue;
      }
    } catch (err) {
      warnings.push(
        `Row ${lineNum}: invalid amount "${amountStr}", skipping`,
      );
      continue;
    }

    // Extract payee
    const payee = row.payee ? String(row.payee).trim() : "";
    if (!payee) {
      warnings.push(`Row ${lineNum}: missing payee, skipping`);
      continue;
    }

    // Extract memo
    const memo = row.memo ? String(row.memo).trim() : "";

    // Generate import ID with occurrence tracking
    const occurrenceKey = `${date}:${amount}:${payee}`;
    const occurrence = occurrenceMap.get(occurrenceKey) ?? 0;
    occurrenceMap.set(occurrenceKey, occurrence + 1);

    const importId = generateImportId(date, amount, payee, occurrence);

    transactions.push({ date, amount, payee, memo, importId });
  }

  return {
    format: "json",
    transactions,
    warnings,
  };
}
