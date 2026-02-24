/**
 * Shared types for bank file parsing.
 */

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  amount: number; // milliunits
  payee: string;
  memo: string;
  importId: string;
}

export interface ParseResult {
  format: "csv" | "ofx" | "qfx";
  transactions: ParsedTransaction[];
  accountName?: string;
  warnings: string[];
}

export type FileFormat = "csv" | "ofx" | "qfx" | "unknown";
