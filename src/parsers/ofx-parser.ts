import { parse as parseOfx } from "ofx-js";
import { ParseError } from "../utils/errors.js";
import { dollarsToMilliunits } from "../utils/milliunit.js";
import { generateImportId } from "../utils/import-id.js";
import type { ParsedTransaction, ParseResult, FileFormat } from "./types.js";

interface OfxTransaction {
  TRNTYPE: string;
  DTPOSTED: string;
  TRNAMT: string;
  NAME?: string;
  MEMO?: string;
  FITID?: string;
}

function parseOfxDate(dateStr: string): string {
  // OFX dates are YYYYMMDD or YYYYMMDDHHMMSS[.XXX:GMT]
  const cleaned = dateStr.replace(/\[.*\]/, "").trim();
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    throw new ParseError(`Invalid OFX date format: ${dateStr}`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeTransactionList(
  stmtTrn: OfxTransaction | OfxTransaction[] | undefined,
): OfxTransaction[] {
  if (!stmtTrn) return [];
  return Array.isArray(stmtTrn) ? stmtTrn : [stmtTrn];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function dig(obj: any, ...keys: string[]): any {
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

export async function parseOfxContent(
  content: string,
  format: FileFormat = "ofx",
): Promise<ParseResult> {
  if (!content.trim()) {
    throw new ParseError("OFX file is empty");
  }

  let parsed: Record<string, any>;
  try {
    parsed = await parseOfx(content);
  } catch (err) {
    throw new ParseError(
      `Failed to parse OFX file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // The ofx-js library wraps everything under an "OFX" key
  const ofx = parsed.OFX ?? parsed;

  // Try bank statement path first, then credit card path
  const bankStmtRs = dig(ofx, "BANKMSGSRSV1", "STMTTRNRS", "STMTRS");
  const ccStmtRs = dig(ofx, "CREDITCARDMSGSRSV1", "CCSTMTTRNRS", "CCSTMTRS");
  const stmtRs = bankStmtRs ?? ccStmtRs;

  if (!stmtRs) {
    throw new ParseError(
      "OFX file does not contain bank or credit card statement data",
    );
  }

  const accountName =
    stmtRs.BANKACCTFROM?.ACCTID ?? stmtRs.CCACCTFROM?.ACCTID;

  const rawTransactions = normalizeTransactionList(
    stmtRs.BANKTRANLIST?.STMTTRN,
  );

  const transactions: ParsedTransaction[] = [];
  const warnings: string[] = [];
  const occurrenceMap = new Map<string, number>();

  for (let i = 0; i < rawTransactions.length; i++) {
    const txn = rawTransactions[i];

    try {
      const date = parseOfxDate(txn.DTPOSTED);
      const amount = dollarsToMilliunits(txn.TRNAMT);
      const payee = (txn.NAME ?? txn.MEMO ?? "").trim();
      const memo = txn.MEMO?.trim() ?? "";

      if (!payee) {
        warnings.push(`Transaction ${i + 1}: missing payee name, using FITID`);
      }

      const displayPayee = payee || txn.FITID || `Unknown-${i + 1}`;

      const occurrenceKey = `${date}:${amount}:${displayPayee}`;
      const occurrence = occurrenceMap.get(occurrenceKey) ?? 0;
      occurrenceMap.set(occurrenceKey, occurrence + 1);

      const importId = generateImportId(date, amount, displayPayee, occurrence);

      transactions.push({
        date,
        amount,
        payee: displayPayee,
        memo,
        importId,
      });
    } catch (err) {
      warnings.push(
        `Transaction ${i + 1}: ${err instanceof Error ? err.message : String(err)}, skipping`,
      );
    }
  }

  return {
    format: format === "qfx" ? "qfx" : "ofx",
    transactions,
    accountName,
    warnings,
  };
}
