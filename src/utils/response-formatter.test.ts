import { describe, it, expect } from "vitest";
import { formatToolResponse } from "./response-formatter.js";

describe("formatToolResponse", () => {
  it("produces a single text content block", () => {
    const result = formatToolResponse("## Title\nSome info", { key: "value" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });

  it("includes markdown summary at the top", () => {
    const result = formatToolResponse("## Budget Overview", { total: 1000 });
    expect(result.content[0].text).toMatch(/^## Budget Overview/);
  });

  it("includes JSON data block", () => {
    const data = { accounts: [{ name: "Checking", balance: 5000 }] };
    const result = formatToolResponse("## Summary", data);
    const text = result.content[0].text;
    expect(text).toContain("```json");
    expect(text).toContain('"Checking"');
  });

  it("separates markdown and JSON with a divider", () => {
    const result = formatToolResponse("Info", {});
    expect(result.content[0].text).toContain("---");
  });
});
