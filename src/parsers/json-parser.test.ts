import { describe, it, expect } from "vitest";
import { parseJsonContent } from "./json-parser.js";

describe("parseJsonContent", () => {
  describe("valid JSON arrays", () => {
    it("parses array of valid transactions", () => {
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
      expect(result.transactions[1].payee).toBe("AMAZON");
    });

    it("converts dollar amounts to milliunits", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: -4.85,
          payee: "STORE",
          memo: "",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions[0].amount).toBe(-4850);
    });

    it("handles positive amounts", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-16",
          amount: 3500.00,
          payee: "PAYCHECK",
          memo: "",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions[0].amount).toBe(3500000);
    });

    it("handles string amounts", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: "-25.50",
          payee: "SHOP",
          memo: "",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions[0].amount).toBe(-25500);
    });
  });

  describe("JSON structure variants", () => {
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

    it("handles optional fields", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: 100,
          payee: "STORE",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].memo).toBe("");
      expect(result.transactions[0].date).toBe("2026-01-15");
    });
  });

  describe("import ID generation", () => {
    it("generates deterministic import IDs", () => {
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

    it("handles duplicate transactions with occurrence tracking", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: 100,
          payee: "STORE",
          memo: "",
        },
        {
          date: "2026-01-15",
          amount: 100,
          payee: "STORE",
          memo: "",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].importId).not.toBe(
        result.transactions[1].importId,
      );
    });
  });

  describe("error handling", () => {
    it("throws ParseError for invalid JSON", () => {
      expect(() => parseJsonContent("{invalid json")).toThrow("Failed to parse JSON");
    });

    it("throws ParseError for empty content", () => {
      expect(() => parseJsonContent("")).toThrow("empty");
    });

    it("throws ParseError for non-array, non-wrapped content", () => {
      expect(() => parseJsonContent("123")).toThrow(
        "must be an array of transactions",
      );
    });

    it("throws ParseError for plain string", () => {
      expect(() => parseJsonContent('"hello"')).toThrow(
        "must be an array of transactions",
      );
    });

    it("throws ParseError for object without transactions field", () => {
      const json = JSON.stringify({ data: [] });
      expect(() => parseJsonContent(json)).toThrow(
        "must be an array of transactions",
      );
    });
  });

  describe("row validation and warnings", () => {
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
      expect(result.warnings.some((w) => w.includes("missing date"))).toBe(
        true,
      );
    });

    it("skips rows with invalid date", () => {
      const json = JSON.stringify([
        {
          date: "not-a-date",
          amount: 100,
          payee: "TEST",
          memo: "",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes("could not parse date"))).toBe(
        true,
      );
    });

    it("skips rows with missing amount", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          payee: "STORE",
          memo: "",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes("missing amount"))).toBe(
        true,
      );
    });

    it("skips rows with invalid amount", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: "not-a-number",
          payee: "STORE",
          memo: "",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes("invalid amount"))).toBe(
        true,
      );
    });

    it("skips rows with missing payee", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: 100,
          memo: "",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes("missing payee"))).toBe(
        true,
      );
    });

    it("processes non-object rows with warning", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: 100,
          payee: "VALID",
          memo: "",
        },
        "not an object",
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(1);
      expect(result.warnings.some((w) => w.includes("not an object"))).toBe(
        true,
      );
    });

    it("skips rows with null payee", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: 100,
          payee: null,
          memo: "",
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(0);
    });
  });

  describe("empty file handling", () => {
    it("throws error when JSON array is empty", () => {
      expect(() => parseJsonContent("[]")).toThrow("no transactions");
    });
  });

  describe("field mapping flexibility", () => {
    it("works with additional fields in JSON objects", () => {
      const json = JSON.stringify([
        {
          date: "2026-01-15",
          amount: 100,
          payee: "STORE",
          memo: "test",
          extra_field: "ignored",
          another_field: 123,
        },
      ]);
      const result = parseJsonContent(json);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].payee).toBe("STORE");
    });
  });
});
