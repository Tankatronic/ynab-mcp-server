import { describe, it, expect } from "vitest";
import { parseDate, isValidDate } from "./date-parser.js";

describe("parseDate", () => {
  it("parses ISO format (YYYY-MM-DD)", () => {
    expect(parseDate("2026-01-15")).toBe("2026-01-15");
    expect(parseDate("2026-1-5")).toBe("2026-01-05");
  });

  it("parses MM/DD/YYYY format", () => {
    expect(parseDate("01/15/2026")).toBe("2026-01-15");
    expect(parseDate("1/5/2026")).toBe("2026-01-05");
    expect(parseDate("12/31/2026")).toBe("2026-12-31");
  });

  it("parses MM-DD-YYYY format", () => {
    expect(parseDate("01-15-2026")).toBe("2026-01-15");
  });

  it("parses MM/DD/YY with century inference", () => {
    expect(parseDate("01/15/26")).toBe("2026-01-15");
    expect(parseDate("01/15/99")).toBe("1999-01-15");
  });

  it("parses compact YYYYMMDD", () => {
    expect(parseDate("20260115")).toBe("2026-01-15");
  });

  it("parses DD/MM/YYYY with hint", () => {
    expect(parseDate("15/01/2026", "DD/MM/YYYY")).toBe("2026-01-15");
    expect(parseDate("31/12/2026", "DD/MM/YYYY")).toBe("2026-12-31");
  });

  it("returns null for unrecognized formats", () => {
    expect(parseDate("January 15, 2026")).toBeNull();
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(parseDate("  2026-01-15  ")).toBe("2026-01-15");
  });
});

describe("isValidDate", () => {
  it("accepts valid dates", () => {
    expect(isValidDate("2026-01-15")).toBe(true);
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true); // leap year
  });

  it("rejects invalid dates", () => {
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2025-02-29")).toBe(false); // not a leap year
    expect(isValidDate("not-a-date")).toBe(false);
  });
});
