---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: [prd.md, product-brief-workspace-2026-02-14.md]
workflowType: 'architecture'
project_name: 'YNAB MCP Server'
user_name: 'Tank'
date: '2026-02-23'
status: 'complete'
completedAt: '2026-02-23'
---

# Architecture Decision Document - YNAB MCP Server

**Author:** Winston (Architect Agent)
**Date:** 2026-02-23
**For:** Tank (intermediate-skill developer, hobby pace)

## Project Context Analysis

### Requirements Overview

The YNAB MCP Server has **41 functional requirements** across 6 categories and **15 non-functional requirements** across 4 categories. The requirements decompose as follows:

| Category | FRs | Architectural Implication |
|----------|-----|--------------------------|
| YNAB API Access (FR1-17) | 17 | Thin wrapper over YNAB REST API; needs robust HTTP client with auth, rate limiting, delta sync |
| Bank Export Parsing (FR18-23) | 6 | Multi-format file parser (CSV/OFX/QFX); auto-detection; exact milliunit conversion; deterministic ID generation |
| Transaction Import (FR24-29) | 6 | Bulk creation with dedup; category suggestion pipeline; split transaction support; payee matching |
| Workflow Configuration (FR30-34) | 5 | File-based config system; bundled + user-custom directories; markdown/yaml format |
| Budget Querying (FR35-38) | 4 | Aggregation logic composing multiple YNAB API calls into analytical responses |
| Error Handling (FR39-41) | 3 | Structured error objects; rate limit surfacing; parse error context with line numbers |

| NFR Category | NFRs | Architectural Implication |
|--------------|------|--------------------------|
| Security & Privacy (NFR1-4) | 4 | Token redaction in all output paths; no external network calls; no disk writes; stateless |
| Reliability & Data Integrity (NFR5-8) | 4 | Integer arithmetic for milliunits; deterministic import_ids; explicit failure on parse errors |
| Integration (NFR9-12) | 4 | YNAB API v1 compatibility; rate limit handling; stdio MCP transport; delta sync support |
| Developer Experience (NFR13-15) | 3 | 15-minute setup; actionable LLM-targeted error messages; human-readable config files |

### Scale & Complexity Assessment

**Classification:** Medium complexity, single-user local tool.

- **Concurrency model:** Single-threaded, single-user. No concurrent request handling needed. The MCP stdio transport processes one tool call at a time.
- **Data volume:** Typical import batch is 10-200 transactions. Maximum realistic single import is ~500 transactions (one month of heavy credit card use). YNAB bulk create endpoint handles this in a single API call.
- **State management:** Stateless by design (NFR3). No database, no cache, no session state. Every tool invocation is independent. The YNAB API is the sole source of truth.
- **API surface:** 13 MCP tools. Within the 5-15 best practice range. Each tool internally composes 1-5 YNAB API calls.
- **File I/O:** Read-only. Parse bank export files from user's filesystem. No file writes.

### Technical Constraints & Dependencies

| Constraint | Source | Impact |
|-----------|--------|--------|
| YNAB API rate limit: 200 req/hour | YNAB API | Bulk operations must minimize API calls; batch transaction creation is mandatory |
| stdio transport only | Claude Desktop integration | No HTTP server, no WebSocket; communication via stdin/stdout JSON-RPC |
| No persistent storage | NFR3 | Cannot cache YNAB data between invocations; delta sync via `server_knowledge` must be passed through tool parameters |
| No external network calls | NFR2 | Only `api.ynab.com` allowed; no npm telemetry at runtime, no analytics |
| Milliunit integer arithmetic | NFR6 | Cannot use JavaScript floating point for amount conversion; must use integer multiplication/string parsing |
| Single-user local execution | Architecture | No multi-tenancy, no auth beyond YNAB token, no deployment infrastructure |

### Cross-Cutting Concerns

1. **Token Security:** The YNAB personal access token flows through every YNAB API call. It must be scrubbed from all error messages, log output, and tool responses. This affects error handling, logging, and the YNAB client wrapper.

2. **Milliunit Conversion:** Amounts cross boundaries at three points: bank file parsing, tool responses, and YNAB API calls. Conversion logic must be centralized and use integer arithmetic everywhere. This is a single utility module used by parsers and tools.

3. **Error Formatting:** Every tool must return errors in the same structured format (`{ code, message, retryable, retryAfterMs }`). This is enforced at the tool registration layer, not per-tool.

4. **Rate Limit Awareness:** Rate limit headers from YNAB API responses must be captured and surfaced. This lives in the YNAB client wrapper and is available to all tools.

## Starter Template Evaluation

### Evaluation of Approaches

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| `@modelcontextprotocol/create-server` (official scaffolding) | Official; generates correct project structure; includes stdio transport setup | May generate boilerplate that needs cleanup; ties to SDK conventions | **Selected** |
| Manual from scratch | Full control; no unwanted boilerplate | More setup work; risk of missing MCP protocol details | Rejected |
| Clone existing MCP server repo | Working example to learn from | Carries someone else's patterns and debt | Rejected |

### Decision: Use Official MCP Server Scaffolding

The `@modelcontextprotocol/create-server` package (via `npm create @modelcontextprotocol/server`) generates a TypeScript MCP server project with the correct SDK dependency, stdio transport wiring, and project structure. After scaffolding, we restructure to match our architecture.

### Initialization Sequence

```bash
# Step 1: Scaffold the project
npm create @modelcontextprotocol/server ynab-mcp-server

# Step 2: Enter the project directory
cd ynab-mcp-server

# Step 3: Install production dependencies
npm install ynab csv-parse ofx-js zod

# Step 4: Install dev dependencies
npm install -D vitest @types/node

# Step 5: Restructure to match target architecture (see Project Structure section)
# Move generated index.ts to src/index.ts if not already there
# Create directory structure per architecture spec

# Step 6: Verify the server starts
npx tsx src/index.ts
```

**Note on versions:** Run `npm create @modelcontextprotocol/server@latest` at project initialization time to get the current scaffolding. All dependency versions should use `^` (caret) ranges to allow compatible updates. Verify the following packages resolve correctly during `npm install`:

| Package | Purpose | Minimum Version |
|---------|---------|----------------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation | ^1.12.0 |
| `ynab` | Official YNAB API client | ^2.5.0 |
| `csv-parse` | CSV parsing (part of csv project) | ^5.6.0 |
| `ofx-js` | OFX/QFX file parsing | ^0.2.0 |
| `zod` | Schema validation for tool parameters | ^3.24.0 |
| `typescript` | Build-time type checking | ^5.7.0 |
| `vitest` | Test runner | ^3.0.0 |
| `@types/node` | Node.js type definitions | ^22.0.0 |
| Node.js (runtime) | LTS runtime | >=22.0.0 |

**If `npm create @modelcontextprotocol/server` is not available or produces unexpected output:** Fall back to manual initialization with `npm init -y`, then install `@modelcontextprotocol/sdk` directly and wire up the stdio transport manually. The official SDK README provides the minimal server setup code.

## Core Architectural Decisions

### Decision 1: Data Architecture -- Stateless with YNAB as Source of Truth

**Decision:** No database, no cache, no persistent state. Every tool invocation starts fresh. The YNAB API is the canonical data store.

**Rationale:**
- NFR3 explicitly prohibits persistent storage of financial data
- Eliminates an entire class of bugs (stale cache, inconsistent state, migration issues)
- Simplifies deployment to zero -- npm install and run
- YNAB's `server_knowledge` delta sync parameter can be passed as a tool parameter by the LLM across invocations, enabling efficient re-fetches without server-side state

**Implication for delta sync:** The `server_knowledge` value returned by YNAB API responses is included in tool response data. The LLM (via workflow config instructions) passes it back on subsequent calls. The server never stores it.

**Implication for category suggestion:** The `preview_import` tool fetches recent YNAB transactions on every invocation to build payee-to-category mappings. This is 1-2 API calls per preview, well within rate limits.

### Decision 2: Authentication & Security -- Environment Variable Token, Scrubbed Everywhere

**Decision:** YNAB personal access token is read from the `YNAB_API_TOKEN` environment variable at server startup. It is stored in a module-scoped variable, never passed through tool parameters, and actively scrubbed from any string that exits the server.

**Token flow:**
1. User sets `YNAB_API_TOKEN` in their Claude Desktop MCP config's `env` block
2. Server reads `process.env.YNAB_API_TOKEN` once at startup
3. Token is passed to the YNAB client constructor
4. A `scrubToken()` utility replaces any occurrence of the token in error messages or output with `[REDACTED]`
5. The error handler wrapping every tool invocation runs `scrubToken()` on all output

**Security boundary enforcement:**
- The YNAB client module is the only code that sees the raw token
- All outbound tool responses pass through a sanitization layer
- No `console.log` or `console.error` calls in production code; use a logger wrapper that auto-scrubs

### Decision 3: API & Communication -- MCP Protocol over stdio

**Decision:** The server implements the MCP protocol using the official TypeScript SDK (`@modelcontextprotocol/sdk`) over stdio transport exclusively.

**MCP tool registration pattern:**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "ynab-mcp-server",
  version: "1.0.0",
});

// Example tool registration
server.tool(
  "get_budget_overview",
  "Get a summary of your budget including accounts, balances, and category health",
  {
    budget_id: z.string().optional().describe("Budget ID. Omit to use the default (last used) budget."),
  },
  async ({ budget_id }) => {
    // Tool implementation
    return {
      content: [{ type: "text", text: formattedResult }],
    };
  }
);
```

**Transport wiring:**

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Response structure:** Every tool returns MCP `content` blocks. Read tools return a single `text` content block containing both human-readable summary and structured data (JSON) that the LLM can parse. Error responses use `isError: true` with structured error details.

### Decision 4: Infrastructure -- npm Package, Local Execution

**Decision:** Distributed as an npm package. No Docker, no cloud, no server infrastructure. Users install via npm and configure in Claude Desktop's `claude_desktop_config.json`.

**Claude Desktop configuration:**

```json
{
  "mcpServers": {
    "ynab": {
      "command": "npx",
      "args": ["-y", "ynab-mcp-server"],
      "env": {
        "YNAB_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

**Alternative for development:**

```json
{
  "mcpServers": {
    "ynab": {
      "command": "node",
      "args": ["C:/path/to/ynab-mcp-server/dist/index.js"],
      "env": {
        "YNAB_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Decision 5: Key Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript (strict mode) | Type safety for financial data; MCP SDK is TypeScript-native |
| Runtime | Node.js >= 22 LTS | Current LTS; required for modern ES module support and native fetch |
| MCP SDK | `@modelcontextprotocol/sdk` | Official SDK; maintained by Anthropic; includes stdio transport |
| YNAB client | `ynab` npm package | Official YNAB JavaScript SDK; typed API client; handles auth header |
| CSV parsing | `csv-parse` (from csv project) | Mature, streaming parser; handles quoted fields, custom delimiters |
| OFX/QFX parsing | `ofx-js` | Parses OFX/QFX (SGML-based) to JSON; lightweight; handles QFX (Quicken extension of OFX) |
| Schema validation | `zod` | Required by MCP SDK for tool parameter schemas; runtime validation |
| Build | `tsc` (TypeScript compiler) | Standard; no bundler needed for Node.js CLI tool |
| Test framework | `vitest` | Fast, TypeScript-native, ESM support, compatible with Node.js |
| Package manager | npm | Standard; no need for pnpm/yarn complexity for a solo project |

### Decision 6: Module System -- ESM

**Decision:** The project uses ECMAScript Modules (ESM) exclusively. `"type": "module"` in `package.json`. All imports use `.js` extensions in TypeScript source (required for ESM + tsc).

**Rationale:** The MCP SDK uses ESM. The `ynab` package supports ESM. Node.js 22 has full ESM support. Mixing CJS and ESM creates unnecessary friction.

### Decision Impact Analysis

| Decision | Simplifies | Complicates | Risk |
|----------|-----------|-------------|------|
| Stateless | Deployment, testing, reasoning about state | Category suggestion (must re-fetch each time) | Slightly higher API usage per session |
| Env var token | Config, security boundary | Nothing significant | User must remember to set env var |
| stdio transport | No HTTP server to manage | Cannot test via curl; must use MCP client | Standard for MCP; well-documented |
| npm distribution | Installation, updates | Must publish to npm registry | Need npm account; standard process |
| ESM only | Consistency, modern syntax | Some npm packages may be CJS-only | Mitigated by choosing ESM-compatible deps |
| Official YNAB SDK | Typed API client, less code | Locked to SDK's API surface | SDK covers all v1 endpoints |

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Files:**
- All source files: `kebab-case.ts` (e.g., `budget-overview.ts`, `parse-bank-export.ts`)
- Test files: `kebab-case.test.ts` colocated next to source (e.g., `milliunit.test.ts` next to `milliunit.ts`)
- Tool files: named exactly after the tool's snake_case name converted to kebab-case (e.g., tool `get_budget_overview` lives in `get-budget-overview.ts`)
- Workflow config files: `kebab-case.md` (e.g., `import-categorize.md`, `reconcile-import.md`)

**Functions & Variables:**
- Functions: `camelCase` (e.g., `parseCsvFile`, `convertToMilliunits`, `generateImportId`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `YNAB_API_BASE_URL`, `MAX_BATCH_SIZE`)
- Types & Interfaces: `PascalCase` (e.g., `ParsedTransaction`, `ToolErrorResponse`, `BudgetOverview`)
- Enums: `PascalCase` name, `PascalCase` members (e.g., `ErrorCode.RateLimited`)

**MCP Tools:**
- Tool names: `snake_case` (e.g., `parse_bank_export`, `get_budget_overview`)
- Tool parameter names: `snake_case` (e.g., `budget_id`, `date_range`, `file_path`)
- No service prefix on tool names (single-purpose server)

### Structure Patterns

**Module organization:** Functional grouping by domain, not by technical layer.

```
src/
  tools/           -- MCP tool implementations (one file per tool)
  parsers/         -- Bank file parsers (CSV, OFX)
  ynab/            -- YNAB API client wrapper
  utils/           -- Shared utilities (milliunit, import-id, errors)
  workflows/       -- Bundled workflow config files
```

**Tool implementation pattern:** Every tool file exports a single registration function.

```typescript
// src/tools/get-budget-overview.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getYnabClient } from "../ynab/client.js";
import { formatError } from "../utils/errors.js";

export function registerGetBudgetOverview(server: McpServer): void {
  server.tool(
    "get_budget_overview",
    "Get a summary of your budget including accounts, balances, and category group totals",
    {
      budget_id: z.string().optional().describe(
        "Budget ID. Omit to use the default (last used) budget."
      ),
    },
    async ({ budget_id }) => {
      try {
        const ynab = getYnabClient();
        const resolvedId = budget_id ?? "default";
        const budgetResponse = await ynab.budgets.getBudgetById(resolvedId);
        // ... compose response
        return {
          content: [{ type: "text", text: composed }],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
```

**Tool registration in index.ts:**

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGetBudgetOverview } from "./tools/get-budget-overview.js";
import { registerParseBankExport } from "./tools/parse-bank-export.js";
// ... all tool registrations

const server = new McpServer({
  name: "ynab-mcp-server",
  version: "1.0.0",
});

// Register all tools
registerGetBudgetOverview(server);
registerParseBankExport(server);
// ... etc

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Test organization:** Tests are colocated with source files.

```
src/utils/milliunit.ts
src/utils/milliunit.test.ts
src/parsers/csv-parser.ts
src/parsers/csv-parser.test.ts
```

Test fixtures (sample bank export files) live in a dedicated directory:

```
test-fixtures/
  csv/
    chase-credit.csv
    bofa-checking.csv
    wells-fargo.csv
  ofx/
    sample.ofx
    sample.qfx
```

### Format Patterns

**Tool response format (success):**

```typescript
{
  content: [
    {
      type: "text",
      text: `## Budget Overview: My Budget\n\n**Total Accounts:** 6\n**Uncleared Balance:** $1,234.56\n\n### Accounts\n| Account | Balance | Type |\n|---------|---------|------|\n| Checking | $5,432.10 | checking |\n...\n\n---\n_Raw data:_\n\`\`\`json\n${JSON.stringify(structuredData)}\n\`\`\``
    }
  ]
}
```

The text block contains: (1) a human-readable markdown summary at the top, (2) a JSON block at the bottom with structured data the LLM can parse programmatically. This dual format lets the LLM choose whether to present the summary or work with the data.

**Tool response format (error):**

```typescript
{
  isError: true,
  content: [
    {
      type: "text",
      text: JSON.stringify({
        code: "RATE_LIMITED",
        message: "YNAB API rate limit reached. 0 of 200 requests remaining. Resets in 23 minutes.",
        retryable: true,
        retryAfterMs: 1380000
      })
    }
  ]
}
```

**Standard error codes:**

| Code | When Used |
|------|-----------|
| `NOT_FOUND` | Budget, account, transaction, or category ID does not exist |
| `INVALID_INPUT` | Tool parameter validation failure; malformed file content |
| `UNAUTHORIZED` | YNAB API returns 401; token missing, expired, or invalid |
| `RATE_LIMITED` | YNAB API returns 429; include remaining quota and reset time |
| `API_ERROR` | YNAB API returns 5xx or unexpected error |
| `PARSE_ERROR` | Bank file parsing failure; include line number and details |
| `FILE_NOT_FOUND` | Specified file path does not exist or is not readable |
| `UNSUPPORTED_FORMAT` | File format not recognized as CSV, OFX, or QFX |

**Amount formatting in responses:**

Always include both milliunit and human-readable formats in responses:

```
Amount: -45670 ($-45.67)
```

The human-readable format uses `$` prefix, two decimal places, negative sign before the `$`. The milliunit value is always the authoritative number.

### Process Patterns

**Error handling -- try/catch wrapper pattern:**

Every tool implementation wraps its logic in a try/catch. The catch block uses a centralized `formatError` function that:
1. Detects YNAB API errors (checks for `error.error` structure from the ynab SDK)
2. Detects file system errors (ENOENT, EACCES)
3. Detects parse errors (custom `ParseError` class)
4. Maps to the appropriate error code
5. Scrubs the YNAB token from all error messages
6. Returns the standard MCP error response shape

```typescript
// src/utils/errors.ts
export function formatError(error: unknown): ToolResponse {
  const scrubbed = scrubToken(extractMessage(error));

  if (isYnabApiError(error)) {
    const ynabError = error as YnabApiError;
    if (ynabError.error.id === "429") {
      return makeErrorResponse("RATE_LIMITED", scrubbed, true, getRetryAfter(ynabError));
    }
    if (ynabError.error.id === "401") {
      return makeErrorResponse("UNAUTHORIZED", "YNAB API authentication failed. Check your YNAB_API_TOKEN.", false);
    }
    if (ynabError.error.id === "404") {
      return makeErrorResponse("NOT_FOUND", scrubbed, false);
    }
    return makeErrorResponse("API_ERROR", scrubbed, true);
  }

  if (error instanceof ParseError) {
    return makeErrorResponse("PARSE_ERROR", scrubbed, false);
  }

  return makeErrorResponse("API_ERROR", `Unexpected error: ${scrubbed}`, false);
}
```

**Milliunit conversion -- integer arithmetic only:**

```typescript
// src/utils/milliunit.ts
export function dollarsToMilliunits(dollars: string): number {
  // Parse the string representation to avoid floating point
  const cleaned = dollars.replace(/[$,\s]/g, "");
  const negative = cleaned.startsWith("-") || cleaned.startsWith("(");
  const abs = cleaned.replace(/[()-]/g, "");

  const parts = abs.split(".");
  const whole = parseInt(parts[0] || "0", 10);
  const decimalStr = (parts[1] || "").padEnd(3, "0").slice(0, 3);
  const decimal = parseInt(decimalStr, 10);

  const milliunits = whole * 1000 + decimal;
  return negative ? -milliunits : milliunits;
}

export function milliunitsToDisplay(milliunits: number): string {
  const negative = milliunits < 0;
  const abs = Math.abs(milliunits);
  const whole = Math.floor(abs / 1000);
  const frac = abs % 1000;
  const decimal = Math.floor(frac / 10).toString().padStart(2, "0");
  return `${negative ? "-" : ""}$${whole.toLocaleString()}.${decimal}`;
}
```

**IMPORTANT:** The `dollarsToMilliunits` function takes a *string*, not a number. This is intentional. Bank export amounts are always parsed as strings first, then converted. Never do `parseFloat(amount) * 1000`.

**Import ID generation -- deterministic:**

```typescript
// src/utils/import-id.ts
import { createHash } from "node:crypto";

export function generateImportId(
  date: string,       // YYYY-MM-DD
  amount: number,     // milliunits
  payee: string,      // raw payee string from bank
  occurrence: number  // 0-indexed; handles same date+amount+payee appearing twice
): string {
  const input = `${date}:${amount}:${payee}:${occurrence}`;
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 16);
  return `YNAB-MCP:${hash}`;
}
```

The `occurrence` parameter handles the case where two transactions on the same date have identical amounts and payees (e.g., two $5.00 charges at the same coffee shop). The parser assigns occurrence indices based on order within the source file.

**Validation -- Zod schemas at the boundary:**

All tool parameters are validated by Zod schemas defined inline in the `server.tool()` registration. No additional validation layer is needed for parameters. However, file content validation (parsed CSV rows, OFX structure) uses custom validation in the parser modules, throwing `ParseError` with context.

### AI Agent Enforcement Guidelines

These rules are for the AI coding agent that will implement this architecture. Include this section verbatim in any agent instructions.

**Rule 1: One tool per file.** Each MCP tool gets its own file in `src/tools/`. The file exports a single `register*` function. No file contains more than one tool.

**Example -- correct:**
```
src/tools/get-budget-overview.ts    -- exports registerGetBudgetOverview
src/tools/search-transactions.ts    -- exports registerSearchTransactions
```

**Example -- wrong:**
```
src/tools/budget-tools.ts           -- exports multiple tools (NO)
```

**Rule 2: Never use `parseFloat` or `Number()` for amount conversion.** All dollar-to-milliunit conversions must go through `dollarsToMilliunits()` in `src/utils/milliunit.ts`, which accepts a string and uses integer arithmetic.

**Example -- correct:**
```typescript
const milliunits = dollarsToMilliunits(row.amount);  // row.amount is a string
```

**Example -- wrong:**
```typescript
const milliunits = Math.round(parseFloat(row.amount) * 1000);  // FLOATING POINT BUG
```

**Rule 3: Never log or include the YNAB token in any output.** Every string that exits the server (tool responses, error messages, stderr) must pass through `scrubToken()`. The token value is `process.env.YNAB_API_TOKEN`.

**Rule 4: All tool responses use the dual-format pattern.** Human-readable markdown first, then a JSON code block with structured data. No tool returns only raw JSON or only plain text.

**Rule 5: Error responses must use `isError: true` and the structured error object.** No tool throws exceptions to the MCP layer. All errors are caught and formatted.

**Rule 6: File paths from tool parameters are untrusted input.** Validate that the file exists and is readable before parsing. Use `fs.access()` check. Never pass unsanitized paths to other operations.

**Rule 7: Workflow config files are read-only data.** The server reads them and returns their contents. It never modifies, creates, or deletes workflow config files.

**Rule 8: Test every tool with at least: (a) happy path, (b) invalid input, (c) YNAB API error simulation.** Use vitest mocking to simulate YNAB API responses.

## Project Structure & Boundaries

### Complete Directory Tree

```
ynab-mcp-server/
|-- package.json
|-- tsconfig.json
|-- vitest.config.ts
|-- LICENSE                          # MIT license
|-- .gitignore
|-- .npmignore
|-- src/
|   |-- index.ts                     # Entry point: creates McpServer, registers tools, connects stdio
|   |
|   |-- tools/                       # MCP tool implementations (one file per tool)
|   |   |-- parse-bank-export.ts     # FR18-23: auto-detect + parse CSV/OFX/QFX
|   |   |-- preview-import.ts        # FR26-27: category suggestion + dry-run
|   |   |-- import-transactions.ts   # FR12, FR24-25, FR28-29: bulk create with dedup + splits
|   |   |-- reconcile-import.ts      # FR32: compare import results against source
|   |   |-- get-budget-overview.ts   # FR2-7: composed budget summary
|   |   |-- get-spending-by-category.ts  # FR36: aggregate by category
|   |   |-- get-monthly-trends.ts    # FR37-38: month-over-month comparison
|   |   |-- search-transactions.ts   # FR10-11: flexible search with filters
|   |   |-- create-transaction.ts    # FR12: single transaction + splits
|   |   |-- update-transaction.ts    # FR13: modify existing
|   |   |-- update-category-budget.ts # FR8: change budgeted amount
|   |   |-- list-workflow-configs.ts # FR30, FR33: list available configs
|   |   |-- read-workflow-config.ts  # FR34: return config contents
|   |
|   |-- parsers/                     # Bank file parsing logic
|   |   |-- detect-format.ts         # FR18: auto-detect CSV vs OFX vs QFX by file content
|   |   |-- csv-parser.ts            # FR19: CSV parsing with flexible column mapping
|   |   |-- ofx-parser.ts           # FR20: OFX/QFX parsing via ofx-js
|   |   |-- types.ts                 # ParsedTransaction, ParseResult, ParseError types
|   |   |-- detect-format.test.ts
|   |   |-- csv-parser.test.ts
|   |   |-- ofx-parser.test.ts
|   |
|   |-- ynab/                        # YNAB API client wrapper
|   |   |-- client.ts                # Singleton YNAB API client; reads token from env; exposes typed methods
|   |   |-- types.ts                 # YNAB-specific types (re-exports from ynab SDK + custom)
|   |   |-- rate-limit.ts            # Rate limit tracking from response headers
|   |   |-- client.test.ts
|   |
|   |-- utils/                       # Shared utilities
|   |   |-- milliunit.ts             # FR22, NFR6: dollar <-> milliunit conversion (integer arithmetic)
|   |   |-- import-id.ts             # FR23, NFR7: deterministic import_id generation
|   |   |-- errors.ts                # FR39-41: error formatting, token scrubbing, error codes
|   |   |-- date-parser.ts           # Date format detection and normalization (bank exports)
|   |   |-- response-formatter.ts    # Dual-format response builder (markdown + JSON)
|   |   |-- milliunit.test.ts
|   |   |-- import-id.test.ts
|   |   |-- errors.test.ts
|   |   |-- date-parser.test.ts
|   |   |-- response-formatter.test.ts
|   |
|   |-- workflows/                   # Bundled workflow config files (shipped with package)
|       |-- import-categorize.md     # FR31: import + categorization workflow
|       |-- reconcile-import.md      # FR32: post-import reconciliation workflow
|
|-- test-fixtures/                   # Test data (not shipped in npm package)
|   |-- csv/
|   |   |-- chase-credit.csv         # Chase credit card CSV sample
|   |   |-- bofa-checking.csv        # Bank of America checking CSV sample
|   |   |-- wells-fargo.csv          # Wells Fargo CSV sample
|   |   |-- amex.csv                 # American Express CSV sample
|   |   |-- citi.csv                 # Citi CSV sample
|   |   |-- malformed.csv            # Intentionally broken CSV for error testing
|   |   |-- empty.csv                # Empty file
|   |-- ofx/
|   |   |-- sample.ofx              # Valid OFX file
|   |   |-- sample.qfx              # Valid QFX file (Quicken)
|   |   |-- malformed.ofx           # Broken OFX for error testing
|   |-- snapshots/                   # Expected parse results for snapshot testing
|       |-- chase-credit.expected.json
|       |-- bofa-checking.expected.json
|       |-- sample-ofx.expected.json
```

### FR-to-Directory Mapping

| FR Category | Primary Directory | Supporting Directories |
|-------------|-------------------|----------------------|
| YNAB API Access (FR1-17) | `src/ynab/` | `src/tools/` (individual tool files call ynab client) |
| Bank Export Parsing (FR18-23) | `src/parsers/` | `src/utils/milliunit.ts`, `src/utils/import-id.ts`, `src/utils/date-parser.ts` |
| Transaction Import (FR24-29) | `src/tools/import-transactions.ts`, `src/tools/preview-import.ts` | `src/ynab/`, `src/parsers/` |
| Workflow Config (FR30-34) | `src/workflows/`, `src/tools/list-workflow-configs.ts`, `src/tools/read-workflow-config.ts` | -- |
| Budget Querying (FR35-38) | `src/tools/get-budget-overview.ts`, `src/tools/get-spending-by-category.ts`, `src/tools/get-monthly-trends.ts`, `src/tools/search-transactions.ts` | `src/ynab/` |
| Error Handling (FR39-41) | `src/utils/errors.ts` | `src/ynab/rate-limit.ts` |

### Integration Boundaries

The server has four integration boundaries. Each boundary has a single module responsible for crossing it.

**Boundary 1: MCP Protocol (Claude Desktop <-> Server)**
- **Module:** `src/index.ts` + `@modelcontextprotocol/sdk`
- **Protocol:** JSON-RPC over stdio (stdin/stdout)
- **Data crossing:** Tool invocation requests (JSON) in; tool responses (JSON) out
- **Contract:** MCP tool schemas defined via Zod in each tool registration

**Boundary 2: YNAB API (Server <-> api.ynab.com)**
- **Module:** `src/ynab/client.ts` + `ynab` npm package
- **Protocol:** HTTPS REST API
- **Data crossing:** Typed requests out; JSON responses in (amounts in milliunits)
- **Contract:** YNAB API v1 spec; SDK types enforce shape
- **Rate limit tracking:** `src/ynab/rate-limit.ts` captures `X-Rate-Limit` headers

**Boundary 3: Local File System (Server <-> User's bank export files)**
- **Module:** `src/parsers/detect-format.ts` (entry point), then `csv-parser.ts` or `ofx-parser.ts`
- **Protocol:** `node:fs` (read-only)
- **Data crossing:** Raw file bytes in; `ParsedTransaction[]` out
- **Contract:** `ParseResult` type in `src/parsers/types.ts`

**Boundary 4: Workflow Config File System (Server <-> config files)**
- **Module:** `src/tools/list-workflow-configs.ts`, `src/tools/read-workflow-config.ts`
- **Protocol:** `node:fs` (read-only)
- **Data crossing:** Config file paths and contents
- **Contract:** Markdown/YAML files in `src/workflows/` (bundled) or user-specified directory

### Data Flow Descriptions

**Flow 1: Transaction Import Pipeline**

```
User drops bank CSV
  -> LLM calls parse_bank_export(file_path)
    -> detect-format.ts reads file, identifies CSV
    -> csv-parser.ts parses rows, extracts date/amount/payee
    -> milliunit.ts converts amounts (string -> integer)
    -> import-id.ts generates deterministic IDs
    -> returns ParsedTransaction[] to LLM

  -> LLM calls preview_import(parsed_transactions, budget_id, account_id)
    -> ynab/client.ts fetches recent transactions for the account
    -> builds payee-to-category map from history
    -> matches parsed payees against YNAB payees
    -> suggests categories based on history
    -> returns preview with suggested categories to LLM

  -> LLM presents suggestions to user, user confirms/adjusts

  -> LLM calls import_transactions(transactions_with_categories, budget_id, account_id)
    -> ynab/client.ts bulk-creates transactions via YNAB API
    -> deduplication happens server-side via import_id
    -> returns created/skipped counts

  -> LLM calls reconcile_import(source_summary, import_result)
    -> compares transaction count: parsed vs imported + skipped
    -> compares total amount: parsed sum vs imported sum
    -> returns match/mismatch report
```

**Flow 2: Budget Query**

```
User asks "How's my spending this month?"
  -> LLM calls get_spending_by_category(budget_id, month)
    -> ynab/client.ts fetches categories for the month
    -> ynab/client.ts fetches transactions for the month
    -> aggregates spending by category
    -> computes budget vs actual for each category
    -> returns formatted summary with structured data

  -> LLM presents conversational answer using the data
```

**Flow 3: Workflow Config Usage**

```
User says "Import my bank file"
  -> LLM calls list_workflow_configs()
    -> reads src/workflows/ directory
    -> reads user custom config directory (if configured)
    -> returns list of available configs

  -> LLM calls read_workflow_config("import-categorize")
    -> reads import-categorize.md from workflows directory
    -> returns full markdown content

  -> LLM follows the step-by-step instructions in the config
    -> config tells LLM to call parse_bank_export, then preview_import, etc.
    -> LLM orchestrates the tool sequence as directed by the config
```

### Key Architectural Diagram (Text)

```
+------------------+     stdio (JSON-RPC)     +-------------------+
|  Claude Desktop  | <======================> |  YNAB MCP Server  |
|  (LLM + UI)     |                          |  (src/index.ts)   |
+------------------+                          +-------------------+
                                                |       |       |
                                    +-----------+  +----+  +----+---------+
                                    |              |       |              |
                              +-----v-----+  +----v---+  +v----------+  +v-----------+
                              | src/tools/ |  | src/   |  | src/      |  | src/       |
                              | 13 tools   |  | ynab/  |  | parsers/  |  | workflows/ |
                              +-----+------+  +----+---+  +-----+----+  +------------+
                                    |              |             |
                                    |         +----v----+  +----v------+
                                    |         | YNAB    |  | User's    |
                                    |         | API     |  | bank      |
                                    |         | v1      |  | export    |
                                    |         +---------+  | files     |
                                    |                      +-----------+
                              +-----v------+
                              | src/utils/ |
                              | milliunit  |
                              | import-id  |
                              | errors     |
                              | date-parse |
                              +------------+
```

### Package Configuration

**package.json (key fields):**

```json
{
  "name": "ynab-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for AI-powered YNAB budget management",
  "type": "module",
  "bin": {
    "ynab-mcp-server": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "files": [
    "dist/",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

**tsconfig.json (key fields):**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "test-fixtures"]
}
```

**vitest.config.ts:**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
```

**.npmignore:**

```
src/
test-fixtures/
vitest.config.ts
tsconfig.json
*.test.ts
*.test.js
.github/
```

## Architecture Validation Results

### Coherence Validation

| Check | Status | Notes |
|-------|--------|-------|
| Stateless constraint respected everywhere | PASS | No database, no cache, no disk writes. `server_knowledge` passed as tool parameter. |
| Token never in output | PASS | `scrubToken()` in error formatter; no `console.log` in production; token only in `src/ynab/client.ts` |
| Integer arithmetic for milliunits | PASS | `dollarsToMilliunits()` accepts string, uses integer math; `parseFloat` banned by convention |
| All tools return consistent format | PASS | `formatError()` for errors; `response-formatter.ts` for success; dual-format pattern |
| stdio transport only | PASS | No HTTP server anywhere; `StdioServerTransport` in `index.ts` |
| ESM throughout | PASS | `"type": "module"` in package.json; `.js` extensions in imports; all deps support ESM |
| One tool per file | PASS | 13 files in `src/tools/`, one per tool |
| No external network calls beyond YNAB | PASS | Only dependency making network calls is `ynab` SDK pointing to `api.ynab.com` |

### Requirements Coverage

**Functional Requirements (41/41 covered):**

| FR | Covered By | Implementation Location |
|----|-----------|------------------------|
| FR1 | YNAB client reads `YNAB_API_TOKEN` env var at startup | `src/ynab/client.ts` |
| FR2 | `get_budget_overview` tool lists budgets | `src/tools/get-budget-overview.ts` |
| FR3 | `get_budget_overview` tool returns budget detail | `src/tools/get-budget-overview.ts` |
| FR4 | `get_budget_overview` tool includes accounts | `src/tools/get-budget-overview.ts` |
| FR5 | `get_budget_overview` tool includes account balances | `src/tools/get-budget-overview.ts` |
| FR6 | `get_budget_overview` tool includes categories/groups | `src/tools/get-budget-overview.ts` |
| FR7 | `get_budget_overview` + `get_spending_by_category` return budgeted amounts | `src/tools/get-budget-overview.ts`, `src/tools/get-spending-by-category.ts` |
| FR8 | `update_category_budget` tool | `src/tools/update-category-budget.ts` |
| FR9 | `get_budget_overview` includes payees; `preview_import` uses payee list | `src/tools/get-budget-overview.ts`, `src/tools/preview-import.ts` |
| FR10 | `search_transactions` tool with filters | `src/tools/search-transactions.ts` |
| FR11 | `search_transactions` supports single transaction by ID | `src/tools/search-transactions.ts` |
| FR12 | `create_transaction` and `import_transactions` tools | `src/tools/create-transaction.ts`, `src/tools/import-transactions.ts` |
| FR13 | `update_transaction` tool | `src/tools/update-transaction.ts` |
| FR14 | `update_transaction` tool supports deletion via YNAB API | `src/tools/update-transaction.ts` (delete is a flag on the YNAB transaction update) |
| FR15 | `search_transactions` can filter for scheduled transactions | `src/tools/search-transactions.ts` |
| FR16 | `get_monthly_trends` retrieves budget month summaries | `src/tools/get-monthly-trends.ts` |
| FR17 | YNAB client can retrieve user info; exposed via `get_budget_overview` | `src/ynab/client.ts` |
| FR18 | `parse_bank_export` with auto-detect | `src/tools/parse-bank-export.ts`, `src/parsers/detect-format.ts` |
| FR19 | CSV parser with flexible column mapping | `src/parsers/csv-parser.ts` |
| FR20 | OFX/QFX parser via ofx-js | `src/parsers/ofx-parser.ts` |
| FR21 | Parsers extract date, amount, payee, metadata | `src/parsers/types.ts` (ParsedTransaction type) |
| FR22 | Milliunit conversion with exact precision | `src/utils/milliunit.ts` |
| FR23 | Deterministic import_id generation | `src/utils/import-id.ts` |
| FR24 | `import_transactions` bulk-creates via YNAB API | `src/tools/import-transactions.ts` |
| FR25 | Deduplication via import_id in bulk create | `src/tools/import-transactions.ts` |
| FR26 | `preview_import` suggests categories from YNAB history | `src/tools/preview-import.ts` |
| FR27 | LLM presents suggestions; user modifies before calling `import_transactions` | Workflow config orchestration |
| FR28 | Split transaction support in `create_transaction` and `import_transactions` | `src/tools/create-transaction.ts`, `src/tools/import-transactions.ts` |
| FR29 | `preview_import` matches payees against YNAB payee list | `src/tools/preview-import.ts` |
| FR30 | Workflow configs shipped in `src/workflows/` | `src/workflows/` |
| FR31 | Import + categorization workflow config | `src/workflows/import-categorize.md` |
| FR32 | Reconciliation workflow config | `src/workflows/reconcile-import.md` |
| FR33 | Custom config directory support | `src/tools/list-workflow-configs.ts` reads env `YNAB_MCP_WORKFLOWS_DIR` |
| FR34 | Configs are readable markdown files | `src/workflows/*.md` |
| FR35 | Conversational querying via MCP tools | All `get_*` and `search_*` tools |
| FR36 | `get_spending_by_category` for category/time analysis | `src/tools/get-spending-by-category.ts` |
| FR37 | `get_monthly_trends` for month comparison | `src/tools/get-monthly-trends.ts` |
| FR38 | Underspent/overspent identification in `get_monthly_trends` | `src/tools/get-monthly-trends.ts` |
| FR39 | Structured YNAB API error surfacing | `src/utils/errors.ts` |
| FR40 | File parsing errors with line numbers | `src/parsers/types.ts` (ParseError class), `src/utils/errors.ts` |
| FR41 | Rate limit status reporting | `src/ynab/rate-limit.ts`, `src/utils/errors.ts` |

**Non-Functional Requirements (15/15 covered):**

| NFR | Covered By | Enforcement |
|-----|-----------|-------------|
| NFR1 | Token scrubbing in error formatter | `scrubToken()` in `src/utils/errors.ts`; no `console.log` in production |
| NFR2 | No external dependencies making network calls except `ynab` SDK | Dependency audit; no analytics/telemetry packages |
| NFR3 | No database, no cache, no file writes | Architecture decision; no persistence modules exist |
| NFR4 | Token only in `src/ynab/client.ts`; scrubbed everywhere else | `scrubToken()` + code review convention |
| NFR5 | Integer milliunit arithmetic; deterministic import_id; explicit parse failures | `src/utils/milliunit.ts`, `src/utils/import-id.ts`, `ParseError` |
| NFR6 | `dollarsToMilliunits()` uses string parsing + integer math | `src/utils/milliunit.ts`; unit tests verify precision |
| NFR7 | `generateImportId()` is pure function of (date, amount, payee, occurrence) | `src/utils/import-id.ts`; unit tests verify determinism |
| NFR8 | Parsers throw `ParseError` with context on any failure | `src/parsers/csv-parser.ts`, `src/parsers/ofx-parser.ts` |
| NFR9 | `ynab` SDK targets YNAB API v1 | Dependency version pinning |
| NFR10 | Rate limit headers captured and surfaced in error responses | `src/ynab/rate-limit.ts` |
| NFR11 | `StdioServerTransport` from MCP SDK | `src/index.ts` |
| NFR12 | `server_knowledge` parameter accepted and returned by relevant tools | `src/tools/search-transactions.ts`, `src/tools/get-budget-overview.ts` |
| NFR13 | `npx ynab-mcp-server` works after `npm install`; clear README | npm package config; `bin` field in package.json |
| NFR14 | Structured errors with actionable messages | `src/utils/errors.ts` |
| NFR15 | Workflow configs are markdown files | `src/workflows/*.md` |

### Implementation Readiness Assessment

| Area | Readiness | Notes |
|------|-----------|-------|
| Project scaffolding | Ready | `npm create @modelcontextprotocol/server` or manual init; clear steps |
| YNAB API integration | Ready | `ynab` SDK is well-documented; all needed endpoints identified |
| CSV parsing | Ready | `csv-parse` handles column mapping, delimiters, quoting |
| OFX/QFX parsing | Ready with caveat | `ofx-js` is lightweight; verify it handles QFX correctly in spike; fallback is custom SGML parser |
| Milliunit conversion | Ready | Algorithm defined; string-based; unit-testable |
| Import ID generation | Ready | SHA-256 hash of deterministic input; algorithm defined |
| MCP tool registration | Ready | Pattern defined; SDK API is straightforward |
| Error handling | Ready | Error codes, formatting, token scrubbing all designed |
| Workflow configs | Ready | Markdown files; two MVP configs defined; directory structure set |
| Testing | Ready | vitest configured; test fixtures directory defined; colocated tests |

### Gap Analysis

| Gap | Severity | Mitigation |
|-----|----------|------------|
| `ofx-js` may not handle all QFX variations | Low | Test with real QFX files early; the OFX spec is well-defined; can write thin adapter if needed |
| CSV column auto-detection is heuristic | Medium | Start with known formats (Chase, BofA, Wells, Citi, Amex); users can contribute format configs; `parse_bank_export` should accept optional column mapping hints |
| YNAB SDK may not expose rate limit headers directly | Low | Intercept HTTP responses or use the YNAB SDK's built-in error handling for 429s; rate limit info is in the error response body |
| `server_knowledge` threading through LLM | Low | Document in workflow config that LLM should pass this value; no server-side complexity |
| FR14 (delete transaction) mapped to `update_transaction` | Low | YNAB API uses a `flag_color` or update mechanism; verify SDK supports delete; may need a separate tool if the API endpoint is distinct |
| Custom workflow config directory path | Low | Use `YNAB_MCP_WORKFLOWS_DIR` env var; fall back to no custom configs if unset |

### Completeness Checklist

- [x] All 13 MCP tools have implementation files and registration pattern defined
- [x] All 41 functional requirements mapped to specific source files
- [x] All 15 non-functional requirements have enforcement mechanisms
- [x] Complete directory tree with every file specified
- [x] Package.json, tsconfig.json, vitest.config.ts configuration defined
- [x] Error handling pattern with codes, formatting, and token scrubbing
- [x] Milliunit conversion algorithm with integer arithmetic
- [x] Import ID generation algorithm with deterministic hashing
- [x] MCP tool registration pattern with code example
- [x] Dual-format response pattern (markdown + JSON)
- [x] Integration boundaries documented (MCP, YNAB API, file system, workflow configs)
- [x] Data flow for all three primary flows (import pipeline, budget query, workflow config)
- [x] AI agent enforcement guidelines with concrete correct/incorrect examples
- [x] Naming conventions for files, functions, variables, tools, and parameters
- [x] Test strategy with colocated tests and fixture directory
- [x] npm distribution configuration (bin, files, engines, scripts)
- [x] Claude Desktop configuration example for both npx and local dev
- [x] Dependency list with minimum versions and rationale
- [x] Gap analysis with severity and mitigation for each gap
