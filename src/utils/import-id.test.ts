import { describe, it, expect } from "vitest";
import { generateImportId } from "./import-id.js";

describe("generateImportId", () => {
  it("generates a prefixed hash", () => {
    const id = generateImportId("2026-01-15", -45670, "COFFEE SHOP", 0);
    expect(id).toMatch(/^YNAB-MCP:[0-9a-f]{16}$/);
  });

  it("is deterministic -- same inputs produce same output", () => {
    const id1 = generateImportId("2026-01-15", -45670, "COFFEE SHOP", 0);
    const id2 = generateImportId("2026-01-15", -45670, "COFFEE SHOP", 0);
    expect(id1).toBe(id2);
  });

  it("produces different IDs for different dates", () => {
    const id1 = generateImportId("2026-01-15", -45670, "COFFEE SHOP", 0);
    const id2 = generateImportId("2026-01-16", -45670, "COFFEE SHOP", 0);
    expect(id1).not.toBe(id2);
  });

  it("produces different IDs for different amounts", () => {
    const id1 = generateImportId("2026-01-15", -45670, "COFFEE SHOP", 0);
    const id2 = generateImportId("2026-01-15", -50000, "COFFEE SHOP", 0);
    expect(id1).not.toBe(id2);
  });

  it("produces different IDs for different payees", () => {
    const id1 = generateImportId("2026-01-15", -45670, "COFFEE SHOP", 0);
    const id2 = generateImportId("2026-01-15", -45670, "GROCERY STORE", 0);
    expect(id1).not.toBe(id2);
  });

  it("uses occurrence to differentiate identical transactions", () => {
    const id1 = generateImportId("2026-01-15", -5000, "COFFEE SHOP", 0);
    const id2 = generateImportId("2026-01-15", -5000, "COFFEE SHOP", 1);
    expect(id1).not.toBe(id2);
  });
});
