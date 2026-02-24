import { describe, it, expect, beforeEach } from "vitest";
import {
  formatError,
  scrubToken,
  setToken,
  ParseError,
} from "./errors.js";

describe("scrubToken", () => {
  beforeEach(() => {
    setToken("secret-token-12345");
  });

  it("replaces token with [REDACTED]", () => {
    expect(scrubToken("Error with secret-token-12345 in message")).toBe(
      "Error with [REDACTED] in message",
    );
  });

  it("replaces multiple occurrences", () => {
    expect(
      scrubToken("secret-token-12345 and secret-token-12345"),
    ).toBe("[REDACTED] and [REDACTED]");
  });

  it("returns unchanged text when no token present", () => {
    expect(scrubToken("No token here")).toBe("No token here");
  });

  it("handles empty token gracefully", () => {
    setToken("");
    expect(scrubToken("some text")).toBe("some text");
  });
});

describe("formatError", () => {
  beforeEach(() => {
    setToken("test-token");
  });

  it("handles YNAB 401 errors", () => {
    const error = { error: { id: "401", name: "unauthorized", detail: "Unauthorized" } };
    const result = formatError(error);
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.code).toBe("UNAUTHORIZED");
    expect(parsed.retryable).toBe(false);
  });

  it("handles YNAB 404 errors", () => {
    const error = { error: { id: "404", name: "not_found", detail: "Budget not found" } };
    const result = formatError(error);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.code).toBe("NOT_FOUND");
    expect(parsed.retryable).toBe(false);
  });

  it("handles YNAB 429 rate limit errors", () => {
    const error = { error: { id: "429", name: "too_many_requests", detail: "Rate limited" } };
    const result = formatError(error);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.code).toBe("RATE_LIMITED");
    expect(parsed.retryable).toBe(true);
    expect(parsed.retryAfterMs).toBeGreaterThan(0);
  });

  it("handles ParseError", () => {
    const error = new ParseError("Bad CSV at line 5", 5, "missing amount");
    const result = formatError(error);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.code).toBe("PARSE_ERROR");
    expect(parsed.retryable).toBe(false);
  });

  it("handles generic errors", () => {
    const result = formatError(new Error("Something went wrong"));
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.code).toBe("API_ERROR");
    expect(parsed.message).toContain("Something went wrong");
  });

  it("scrubs token from error messages", () => {
    const result = formatError(new Error("Failed with token test-token"));
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.message).not.toContain("test-token");
    expect(parsed.message).toContain("[REDACTED]");
  });
});

describe("ParseError", () => {
  it("stores line number and detail", () => {
    const err = new ParseError("Bad data", 10, "expected number");
    expect(err.message).toBe("Bad data");
    expect(err.line).toBe(10);
    expect(err.detail).toBe("expected number");
    expect(err.name).toBe("ParseError");
  });
});
