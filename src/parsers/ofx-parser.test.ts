import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseOfxContent } from "./ofx-parser.js";

const FIXTURES = resolve(import.meta.dirname, "../../test-fixtures/ofx");

function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), "utf-8");
}

describe("parseOfxContent", () => {
  it("parses all transactions from OFX file", async () => {
    const result = await parseOfxContent(readFixture("sample.ofx"));
    expect(result.format).toBe("ofx");
    expect(result.transactions).toHaveLength(3);
  });

  it("extracts correct amounts in milliunits", async () => {
    const result = await parseOfxContent(readFixture("sample.ofx"));
    const grocery = result.transactions[0];
    expect(grocery.amount).toBe(-45670);

    const deposit = result.transactions[1];
    expect(deposit.amount).toBe(3500000);
  });

  it("extracts payee names", async () => {
    const result = await parseOfxContent(readFixture("sample.ofx"));
    expect(result.transactions[0].payee).toBe("GROCERY STORE");
    expect(result.transactions[1].payee).toBe("DIRECT DEPOSIT");
  });

  it("parses dates correctly", async () => {
    const result = await parseOfxContent(readFixture("sample.ofx"));
    expect(result.transactions[0].date).toBe("2026-01-15");
    expect(result.transactions[1].date).toBe("2026-01-16");
  });

  it("generates deterministic import IDs", async () => {
    const result1 = await parseOfxContent(readFixture("sample.ofx"));
    const result2 = await parseOfxContent(readFixture("sample.ofx"));
    expect(result1.transactions[0].importId).toBe(
      result2.transactions[0].importId,
    );
  });

  it("extracts account name", async () => {
    const result = await parseOfxContent(readFixture("sample.ofx"));
    expect(result.accountName).toBe("9876543210");
  });

  it("throws ParseError for empty content", async () => {
    await expect(parseOfxContent("")).rejects.toThrow("empty");
  });
});
