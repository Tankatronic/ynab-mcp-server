import { parse } from "csv-parse/sync";
import { ParseError } from "../utils/errors.js";
import { dollarsToMilliunits } from "../utils/milliunit.js";
import { parseDate, type DateFormatHint } from "../utils/date-parser.js";
import { generateImportId } from "../utils/import-id.js";
import type { ParsedTransaction, ParseResult } from "./types.js";

/**
 * Column mapping for CSV parsing.
 * Maps semantic fields to column names in the CSV.
 */
export interface CsvColumnMapping {
  date: string;
  amount?: string;
  debit?: string;
  credit?: string;
  payee: string;
  memo?: string;
}

/**
 * Known bank format profiles for auto-detection.
 */
const KNOWN_FORMATS: Array<{
  name: string;
  detect: (headers: string[]) => boolean;
  mapping: CsvColumnMapping;
  dateHint?: DateFormatHint;
  amountSign?: "invert";
}> = [
  {
    name: "Chase Credit Card",
    detect: (h) =>
      h.includes("Transaction Date") &&
      h.includes("Post Date") &&
      h.includes("Description") &&
      h.includes("Amount"),
    mapping: {
      date: "Transaction Date",
      amount: "Amount",
      payee: "Description",
      memo: "Memo",
    },
    amountSign: "invert", // Chase uses positive for charges
  },
  {
    name: "Chase Checking",
    detect: (h) =>
      h.includes("Posting Date") &&
      h.includes("Description") &&
      h.includes("Amount"),
    mapping: {
      date: "Posting Date",
      amount: "Amount",
      payee: "Description",
    },
  },
  {
    name: "Bank of America",
    detect: (h) =>
      h.includes("Date") &&
      h.includes("Description") &&
      h.includes("Amount"),
    mapping: { date: "Date", amount: "Amount", payee: "Description" },
  },
  {
    name: "Wells Fargo",
    detect: (h) => h.includes("Date") && h.includes("Amount") && h.includes("Description"),
    mapping: { date: "Date", amount: "Amount", payee: "Description" },
  },
  {
    name: "American Express",
    detect: (h) =>
      h.includes("Date") &&
      h.includes("Description") &&
      h.includes("Amount"),
    mapping: { date: "Date", amount: "Amount", payee: "Description" },
  },
  {
    name: "Citi",
    detect: (h) =>
      h.includes("Date") &&
      h.includes("Description") &&
      (h.includes("Debit") || h.includes("Credit")),
    mapping: {
      date: "Date",
      debit: "Debit",
      credit: "Credit",
      payee: "Description",
    },
  },
];

function detectBankFormat(
  headers: string[],
): (typeof KNOWN_FORMATS)[number] | null {
  for (const format of KNOWN_FORMATS) {
    if (format.detect(headers)) {
      return format;
    }
  }
  return null;
}

function autoDetectMapping(headers: string[]): CsvColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim());

  const dateCol =
    headers[lower.findIndex((h) => h === "date")] ??
    headers[lower.findIndex((h) => h.includes("date"))] ??
    headers[0];

  const amountCol =
    headers[lower.findIndex((h) => h === "amount")] ??
    headers[lower.findIndex((h) => h.includes("amount"))];

  const payeeCol =
    headers[lower.findIndex((h) => h === "description")] ??
    headers[lower.findIndex((h) => h.includes("description"))] ??
    headers[lower.findIndex((h) => h === "payee")] ??
    headers[lower.findIndex((h) => h.includes("payee"))] ??
    headers[lower.findIndex((h) => h.includes("memo"))];

  const memoCol =
    headers[lower.findIndex((h) => h === "memo")] ??
    headers[lower.findIndex((h) => h.includes("memo"))];

  if (!dateCol || !payeeCol) {
    throw new ParseError(
      `Could not auto-detect CSV columns. Found headers: ${headers.join(", ")}. ` +
        `Expected at least a date and description/payee column.`,
    );
  }

  return {
    date: dateCol,
    amount: amountCol,
    payee: payeeCol,
    memo: memoCol,
  };
}

export interface CsvParseOptions {
  columnMapping?: CsvColumnMapping;
  dateFormatHint?: DateFormatHint;
  invertAmounts?: boolean;
}

export function parseCsvContent(
  content: string,
  options: CsvParseOptions = {},
): ParseResult {
  if (!content.trim()) {
    throw new ParseError("CSV file is empty");
  }

  let records: Record<string, string>[];
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    throw new ParseError(
      `Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (records.length === 0) {
    throw new ParseError("CSV file contains no data rows");
  }

  const headers = Object.keys(records[0]);
  const bankFormat = detectBankFormat(headers);

  const mapping =
    options.columnMapping ?? bankFormat?.mapping ?? autoDetectMapping(headers);
  const dateHint = options.dateFormatHint ?? bankFormat?.dateHint ?? "auto";
  const invertAmounts =
    options.invertAmounts ?? bankFormat?.amountSign === "invert";

  const transactions: ParsedTransaction[] = [];
  const warnings: string[] = [];
  const occurrenceMap = new Map<string, number>();

  if (bankFormat) {
    warnings.push(`Detected bank format: ${bankFormat.name}`);
  }

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const lineNum = i + 2; // +1 for 0-index, +1 for header row

    // Extract date
    const rawDate = row[mapping.date];
    if (!rawDate) {
      warnings.push(`Row ${lineNum}: missing date, skipping`);
      continue;
    }
    const date = parseDate(rawDate, dateHint);
    if (!date) {
      warnings.push(
        `Row ${lineNum}: could not parse date "${rawDate}", skipping`,
      );
      continue;
    }

    // Extract amount
    let amountStr: string | undefined;
    if (mapping.amount) {
      amountStr = row[mapping.amount];
    } else if (mapping.debit || mapping.credit) {
      const debit = row[mapping.debit ?? ""]?.trim();
      const credit = row[mapping.credit ?? ""]?.trim();
      if (debit && debit !== "" && debit !== "0" && debit !== "0.00") {
        amountStr = `-${debit.replace(/^-/, "")}`;
      } else if (
        credit &&
        credit !== "" &&
        credit !== "0" &&
        credit !== "0.00"
      ) {
        amountStr = credit.replace(/^-/, "");
      }
    }

    if (!amountStr || amountStr.trim() === "") {
      warnings.push(`Row ${lineNum}: missing amount, skipping`);
      continue;
    }

    let amount = dollarsToMilliunits(amountStr);
    if (invertAmounts) {
      amount = -amount;
    }

    // Extract payee
    const payee = row[mapping.payee]?.trim() ?? "";
    if (!payee) {
      warnings.push(`Row ${lineNum}: missing payee/description, skipping`);
      continue;
    }

    // Extract memo
    const memo = mapping.memo ? (row[mapping.memo]?.trim() ?? "") : "";

    // Generate import ID with occurrence tracking
    const occurrenceKey = `${date}:${amount}:${payee}`;
    const occurrence = occurrenceMap.get(occurrenceKey) ?? 0;
    occurrenceMap.set(occurrenceKey, occurrence + 1);

    const importId = generateImportId(date, amount, payee, occurrence);

    transactions.push({ date, amount, payee, memo, importId });
  }

  return {
    format: "csv",
    transactions,
    warnings,
  };
}
