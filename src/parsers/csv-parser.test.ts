import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvContent } from "./csv-parser.js";

const FIXTURES = resolve(import.meta.dirname, "../../test-fixtures/csv");

function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), "utf-8");
}

describe("parseCsvContent", () => {
  describe("Chase credit card format", () => {
    it("parses all transactions", () => {
      const result = parseCsvContent(readFixture("chase-credit.csv"));
      expect(result.format).toBe("csv");
      expect(result.transactions).toHaveLength(5);
    });

    it("detects Chase format and inverts amounts", () => {
      const result = parseCsvContent(readFixture("chase-credit.csv"));
      expect(result.warnings.some((w) => w.includes("Chase Credit Card"))).toBe(
        true,
      );
      const starbucks = result.transactions[0];
      // Chase CSV: Amount = -4.85 (charge)
      // dollarsToMilliunits("-4.85") = -4850
      // invertAmounts -> 4850
      expect(starbucks.amount).toBe(4850);
    });

    it("generates deterministic import IDs", () => {
      const result1 = parseCsvContent(readFixture("chase-credit.csv"));
      const result2 = parseCsvContent(readFixture("chase-credit.csv"));
      expect(result1.transactions[0].importId).toBe(
        result2.transactions[0].importId,
      );
    });

    it("extracts payee names", () => {
      const result = parseCsvContent(readFixture("chase-credit.csv"));
      expect(result.transactions[0].payee).toBe("STARBUCKS STORE 12345");
      expect(result.transactions[1].payee).toBe("AMAZON.COM*AB1CD2EF3");
    });
  });

  describe("Bank of America format", () => {
    it("parses all transactions", () => {
      const result = parseCsvContent(readFixture("bofa-checking.csv"));
      expect(result.transactions).toHaveLength(5);
    });

    it("handles positive amounts (deposits) correctly", () => {
      const result = parseCsvContent(readFixture("bofa-checking.csv"));
      const deposit = result.transactions[0];
      expect(deposit.payee).toBe("DIRECT DEPOSIT - EMPLOYER INC");
      expect(deposit.amount).toBe(3500000);
    });

    it("handles negative amounts (debits) correctly", () => {
      const result = parseCsvContent(readFixture("bofa-checking.csv"));
      const debit = result.transactions[1];
      expect(debit.amount).toBe(-125500);
    });
  });

  describe("malformed CSV", () => {
    it("skips rows with bad dates and logs warnings", () => {
      const result = parseCsvContent(readFixture("malformed.csv"));
      expect(result.transactions.length).toBeLessThan(5);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("skips rows with missing amounts", () => {
      const result = parseCsvContent(readFixture("malformed.csv"));
      expect(result.warnings.some((w) => w.includes("missing amount"))).toBe(
        true,
      );
    });

    it("skips rows with missing payee", () => {
      const result = parseCsvContent(readFixture("malformed.csv"));
      expect(
        result.warnings.some((w) => w.includes("missing payee")),
      ).toBe(true);
    });
  });

  describe("empty CSV", () => {
    it("throws ParseError for empty file", () => {
      expect(() => parseCsvContent("")).toThrow("empty");
    });
  });

  describe("custom column mapping", () => {
    it("accepts explicit column mapping", () => {
      const csv = `trans_date,vendor,cost\n01/15/2026,Coffee Shop,-5.00\n`;
      const result = parseCsvContent(csv, {
        columnMapping: {
          date: "trans_date",
          payee: "vendor",
          amount: "cost",
        },
      });
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].payee).toBe("Coffee Shop");
      expect(result.transactions[0].amount).toBe(-5000);
    });
  });
});
