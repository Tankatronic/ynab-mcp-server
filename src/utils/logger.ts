/**
 * Lightweight logger for MCP server.
 *
 * CRITICAL: MCP servers communicate over stdout (JSON-RPC via stdio transport).
 * ALL log output MUST go to stderr to avoid corrupting the protocol stream.
 *
 * Log levels controlled by LOG_LEVEL env var: DEBUG | INFO | WARN | ERROR
 * Default: INFO
 *
 * All output is scrubbed through scrubToken() to prevent token leakage.
 */

import { scrubToken } from "./errors.js";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let currentLevel: LogLevel = "INFO";
let outputStream: { write(s: string): void } = process.stderr;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function setOutputStream(stream: { write(s: string): void }): void {
  outputStream = stream;
}

function initLogLevel(): void {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (envLevel && envLevel in LEVEL_ORDER) {
    currentLevel = envLevel as LogLevel;
  }
}

// Initialize on module load
initLogLevel();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatContext(context?: unknown): string {
  if (context === undefined || context === null) return "";
  if (context instanceof Error) {
    return ` | ${context.name}: ${context.message}`;
  }
  if (typeof context === "object") {
    try {
      return ` | ${JSON.stringify(context)}`;
    } catch {
      return ` | [unserializable]`;
    }
  }
  return ` | ${String(context)}`;
}

function log(level: LogLevel, category: string, message: string, context?: unknown): void {
  if (!shouldLog(level)) return;

  const raw = `${formatTimestamp()} [${level}] [${category}] ${message}${formatContext(context)}\n`;
  const scrubbed = scrubToken(raw);
  outputStream.write(scrubbed);
}

export const logger = {
  debug: (category: string, message: string, context?: unknown) =>
    log("DEBUG", category, message, context),

  info: (category: string, message: string, context?: unknown) =>
    log("INFO", category, message, context),

  warn: (category: string, message: string, context?: unknown) =>
    log("WARN", category, message, context),

  error: (category: string, message: string, context?: unknown) =>
    log("ERROR", category, message, context),
};

/**
 * Creates a timer for measuring operation duration.
 * Usage:
 *   const done = logger.startTimer();
 *   // ... do work ...
 *   done("tool", "get_budget_overview completed"); // logs with duration
 */
export function startTimer(): (category: string, message: string, context?: unknown) => void {
  const start = performance.now();
  return (category: string, message: string, context?: unknown) => {
    const durationMs = Math.round(performance.now() - start);
    const timedContext =
      context !== undefined && context !== null
        ? typeof context === "object" && !(context instanceof Error)
          ? { ...context, durationMs }
          : { detail: context, durationMs }
        : { durationMs };
    log("INFO", category, message, timedContext);
  };
}
