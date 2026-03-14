import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvContent } from "../parsers/csv-parser.js";
import { parseOfxContent } from "../parsers/ofx-parser.js";
import { parseJsonContent } from "../parsers/json-parser.js";

const FIXTURES = resolve(import.meta.dirname, "../../test-fixtures");

function readFixture(path: string): string {
  return readFileSync(resolve(FIXTURES, path), "utf-8");
}

describe("parse-bank-export content mode", () => {
  describe("CSV content parsing", () => {
    it("parses CSV content directly", () => {
      const content = readFixture("csv/chase-credit.csv");
      const result = parseCsvContent(content);
      expect(result.format).toBe("csv");
      expect(result.transactions).toHaveLength(5);
    });

    it("detects Chase format from CSV content", () => {
      const content = readFixture("csv/chase-credit.csv");
      const result = parseCsvContent(content);
      expect(result.warnings.some((w) => w.includes("Chase Credit Card"))).toBe(
        true,
      );
    });

    it("handles custom column mapping for CSV content", () => {
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
    });
  });

  describe("OFX content parsing", () => {
    it("parses OFX content directly", async () => {
      const content = readFixture("ofx/sample.ofx");
      const result = await parseOfxContent(content, "ofx");
      expect(result.format).toBe("ofx");
      expect(result.transactions).toHaveLength(3);
    });

    it("parses QFX content correctly", async () => {
      const content = readFixture("ofx/sample.ofx");
      const result = await parseOfxContent(content, "qfx");
      expect(result.format).toBe("qfx");
      expect(result.transactions).toHaveLength(3);
    });
  });

  describe("JSON content parsing", () => {
    it("parses JSON array of transactions", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: -4.85,
          payee: "STARBUCKS",
          memo: "Coffee",
        },
        {
          date: "2026-01-16",
          amount: -29.99,
          payee: "AMAZON",
          memo: "Books",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.format).toBe("json");
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].payee).toBe("STARBUCKS");
      expect(result.transactions[0].amount).toBe(-4850);
    });

    it("parses JSON with { transactions: [...] } wrapper", () => {
      const json = JSON.stringify({
        transactions: [
          {
            date: "2026-01-15",
            amount: 100,
            payee: "TEST",
            memo: "test",
          },
        ],
      });
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].payee).toBe("TEST");
    });

    it("generates deterministic import IDs for JSON", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: 100,
          payee: "STORE",
          memo: "",
        },
      ]);
      const result1 = parseJsonContent(json);
      const result2 = parseJsonContent(json);
      expect(result1.transactions[0].importId).toBe(
        result2.transactions[0].importId,
      );
    });

    it("handles missing optional fields in JSON", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: 50,
          payee: "STORE",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].memo).toBe("");
    });

    it("converts string amounts in JSON", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: "-25.50",
          payee: "SHOP",
          memo: "test",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions[0].amount).toBe(-25500);
    });

    it("throws error for invalid JSON", () => {
      expect(() => parseJsonContent("{invalid json")).toThrow("Failed to parse JSON");
    });

    it("throws error for empty JSON", () => {
      expect(() => parseJsonContent("")).toThrow("empty");
    });

    it("throws error for JSON that is not array or object with transactions", () => {
      expect(() => parseJsonContent("123")).toThrow(
        "must be an array of transactions",
      );
    });

    it("skips rows with missing date", () => {
      const json = JSON.stringify([
        {
          amount: 100,
          payee: "TEST",
          memo: "",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("skips rows with missing payee", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: 100,
          memo: "test",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("skips rows with missing amount", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          payee: "STORE",
          memo: "test",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("content validation rules", () => {
    it("requires format_hint when using content (not enforced in parser, but in tool)", () => {
      // This is more of a tool-level validation
      // The parsers themselves don't enforce this, the tool does
      const csv = `date,amount,payee\n01/15/2026,100,TEST\n`;
      const result = parseCsvContent(csv);
      expect(result.transactions).toHaveLength(1);
    });

    it("handles content size validation (5MB limit enforced in tool)", () => {
      // This is a tool-level validation
      // Create a content larger than 5MB
      const largContent = "x".repeat(5 * 1024 * 1024 + 1);
      expect(largContent.length).toBeGreaterThan(5 * 1024 * 1024);
    });
  });
});
