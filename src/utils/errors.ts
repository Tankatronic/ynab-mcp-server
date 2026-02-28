/**
 * Centralized error handling with token scrubbing and structured error responses.
 */

import { logger } from "./logger.js";

export type ErrorCode =
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "FILE_NOT_FOUND"
  | "UNSUPPORTED_FORMAT";

export interface StructuredError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

export interface ToolResponse {
  [key: string]: unknown;
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}

let tokenValue: string | undefined;

export function setToken(token: string): void {
  tokenValue = token;
}

export function scrubToken(text: string): string {
  if (!tokenValue || tokenValue.length === 0) return text;
  return text.replaceAll(tokenValue, "[REDACTED]");
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

interface YnabApiError {
  error: {
    id: string;
    name: string;
    detail: string;
  };
}

function isYnabApiError(error: unknown): error is YnabApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof (error as YnabApiError).error === "object" &&
    (error as YnabApiError).error !== null &&
    "id" in (error as YnabApiError).error
  );
}

function makeErrorResponse(
  code: ErrorCode,
  message: string,
  retryable: boolean,
  retryAfterMs?: number,
): ToolResponse {
  const errorObj: StructuredError = { code, message, retryable };
  if (retryAfterMs !== undefined) {
    errorObj.retryAfterMs = retryAfterMs;
  }
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(errorObj) }],
  };
}

function getRetryAfterMs(error: YnabApiError): number {
  // Default to 15 minutes if we can't determine from the error
  return 15 * 60 * 1000;
}

export function formatError(error: unknown): ToolResponse {
  const scrubbed = scrubToken(extractMessage(error));

  if (isYnabApiError(error)) {
    const ynabError = error as YnabApiError;
    if (ynabError.error.id === "429") {
      logger.warn("ynab", "Rate limit reached", { errorId: ynabError.error.id });
      return makeErrorResponse(
        "RATE_LIMITED",
        `YNAB API rate limit reached. ${scrubbed}`,
        true,
        getRetryAfterMs(ynabError),
      );
    }
    if (ynabError.error.id === "401") {
      logger.error("ynab", "Authentication failed — check YNAB_API_TOKEN");
      return makeErrorResponse(
        "UNAUTHORIZED",
        "YNAB API authentication failed. Check your YNAB_API_TOKEN.",
        false,
      );
    }
    if (ynabError.error.id === "404") {
      logger.warn("ynab", "Resource not found", { detail: scrubbed });
      return makeErrorResponse("NOT_FOUND", scrubbed, false);
    }
    logger.error("ynab", "API error", { errorId: ynabError.error.id, detail: scrubbed });
    return makeErrorResponse("API_ERROR", scrubbed, true);
  }

  if (error instanceof ParseError) {
    logger.error("parser", "Parse error", { message: scrubbed, line: error.line });
    return makeErrorResponse("PARSE_ERROR", scrubbed, false);
  }

  if (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  ) {
    logger.error("fs", "File not found", { message: scrubbed });
    return makeErrorResponse(
      "FILE_NOT_FOUND",
      `File not found: ${scrubbed}`,
      false,
    );
  }

  logger.error("unknown", "Unexpected error", error);
  return makeErrorResponse("API_ERROR", `Unexpected error: ${scrubbed}`, false);
}

export class ParseError extends Error {
  public readonly line?: number;
  public readonly detail?: string;

  constructor(message: string, line?: number, detail?: string) {
    super(message);
    this.name = "ParseError";
    this.line = line;
    this.detail = detail;
  }
}
