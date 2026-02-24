import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { detectFormat } from "./detect-format.js";

const FIXTURES = resolve(import.meta.dirname, "../../test-fixtures");

describe("detectFormat", () => {
  it("detects CSV by extension", async () => {
    expect(await detectFormat(resolve(FIXTURES, "csv/chase-credit.csv"))).toBe(
      "csv",
    );
  });

  it("detects OFX by extension", async () => {
    expect(await detectFormat(resolve(FIXTURES, "ofx/sample.ofx"))).toBe("ofx");
  });

  it("throws ParseError for nonexistent file", async () => {
    await expect(detectFormat("/nonexistent/file.csv")).rejects.toThrow(
      "not readable",
    );
  });
});
