import { describe, it, expect } from "vitest";
import {
  dollarsToMilliunits,
  milliunitsToDisplay,
  formatAmount,
} from "./milliunit.js";

describe("dollarsToMilliunits", () => {
  it("converts whole dollar amounts", () => {
    expect(dollarsToMilliunits("45")).toBe(45000);
    expect(dollarsToMilliunits("0")).toBe(0);
    expect(dollarsToMilliunits("1")).toBe(1000);
  });

  it("converts amounts with cents", () => {
    expect(dollarsToMilliunits("45.67")).toBe(45670);
    expect(dollarsToMilliunits("0.50")).toBe(500);
    expect(dollarsToMilliunits("123.99")).toBe(123990);
  });

  it("converts amounts with sub-cent precision", () => {
    expect(dollarsToMilliunits("45.678")).toBe(45678);
    expect(dollarsToMilliunits("1.001")).toBe(1001);
  });

  it("handles negative amounts", () => {
    expect(dollarsToMilliunits("-45.67")).toBe(-45670);
    expect(dollarsToMilliunits("-100")).toBe(-100000);
  });

  it("handles parenthesized negatives (bank convention)", () => {
    expect(dollarsToMilliunits("(45.67)")).toBe(-45670);
    expect(dollarsToMilliunits("(100)")).toBe(-100000);
  });

  it("handles dollar signs and commas", () => {
    expect(dollarsToMilliunits("$45.67")).toBe(45670);
    expect(dollarsToMilliunits("$1,234.56")).toBe(1234560);
    expect(dollarsToMilliunits("-$45.67")).toBe(-45670);
  });

  it("handles whitespace", () => {
    expect(dollarsToMilliunits(" 45.67 ")).toBe(45670);
    expect(dollarsToMilliunits("$ 45.67")).toBe(45670);
  });

  it("pads short decimal strings", () => {
    expect(dollarsToMilliunits("45.6")).toBe(45600);
    expect(dollarsToMilliunits("45.")).toBe(45000);
  });

  it("truncates long decimal strings beyond 3 digits", () => {
    expect(dollarsToMilliunits("45.6789")).toBe(45678);
  });
});

describe("milliunitsToDisplay", () => {
  it("formats positive amounts", () => {
    expect(milliunitsToDisplay(45670)).toBe("$45.67");
    expect(milliunitsToDisplay(1000)).toBe("$1.00");
    expect(milliunitsToDisplay(500)).toBe("$0.50");
  });

  it("formats negative amounts", () => {
    expect(milliunitsToDisplay(-45670)).toBe("-$45.67");
    expect(milliunitsToDisplay(-1000)).toBe("-$1.00");
  });

  it("formats zero", () => {
    expect(milliunitsToDisplay(0)).toBe("$0.00");
  });

  it("formats large amounts with locale separators", () => {
    const result = milliunitsToDisplay(1234560000);
    expect(result).toMatch(/\$1,234,560\.00/);
  });
});

describe("formatAmount", () => {
  it("includes both milliunit and display format", () => {
    expect(formatAmount(-45670)).toBe("-45670 (-$45.67)");
    expect(formatAmount(1000)).toBe("1000 ($1.00)");
  });
});
