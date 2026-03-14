---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
inputDocuments: [product-brief-workspace-2026-02-14.md, ynab-api-v1-spec]
workflowType: 'prd'
briefCount: 1
researchCount: 0
brainstormingCount: 0
projectDocsCount: 0
classification:
  projectType: developer_tool
  domain: fintech
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - YNAB MCP Server

**Author:** Tank
**Date:** 2026-02-22

## Executive Summary

YNAB MCP Server is an open-source MCP server that enables AI-powered YNAB budget management without third-party financial data aggregators. It targets privacy-conscious YNAB power users who currently manage transactions manually -- importing bank exports, categorizing by hand, reconciling across multiple accounts.

**Core Differentiator:** A "dumb server + smart workflow configs" architecture. The MCP server provides stateless, reliable tools. Intelligence lives in workflow configuration files (markdown/yaml) that the LLM reads and executes. The server stays lean; the system grows smarter through community-contributed configs, not code changes.

**Target Users:** Technical YNAB users already using LLMs and MCP servers. Privacy-minded individuals who refuse to connect bank accounts through Plaid/MX. Power users managing multiple accounts across banks and credit cards.

**Distribution:** Free, open-source on GitHub. TypeScript/Node.js, distributed as an npm package, integrates with Claude Desktop via stdio transport.

## Success Criteria

### User Success

- **The "aha!" moment:** User drops a bank CSV, the LLM parses it, suggests categories from YNAB history, and bulk-imports 50+ transactions in one conversation. 30+ minutes of manual work happens in under 2 minutes.
- **Conversational budget access:** Natural language questions about budget data get instant answers without navigating YNAB's limited built-in reports.
- **Zero trust burden:** Users never double-check imported transactions against their bank. If the tool imports it, it's correct. The moment a user must manually verify, the tool has failed.
- **Privacy confidence:** No financial data leaves the user's machine or passes through third-party aggregators.

### Community Adoption

- **Early signal (3 months):** 50+ GitHub stars, active issues/discussions from real users
- **Growth signal (6-12 months):** Community-contributed workflow configs, bank format parsers, or PRs
- **Long-term signal:** Go-to recommendation in r/ynab and MCP tool directories for privacy-conscious users

### Technical Success

- **Import reliability:** 100% accuracy on transaction import -- correct amounts, dates, payees, deduplication. No silent data loss or corruption.
- **Reconciliation via workflow:** Post-import verification (totals, counts, balance checks) handled by LLM-driven workflow configs, not hardcoded server logic.
- **Clean separation of concerns:** MCP server = dumb, reliable tools. Workflow configs = defined steps the LLM follows. LLM = smart orchestration layer.
- **Performance:** Model-driven -- users adjust by selecting different models. YNAB API rate limit (200 req/hour) is the real constraint.
- **Setup experience:** Clone to first successful import in under 15 minutes with clear documentation.

### Measurable Outcomes

| Outcome | Metric | Target |
|---------|--------|--------|
| Import accuracy | Transactions correctly imported vs source file | 100% |
| Time savings | Time to import + categorize vs manual | 10x faster |
| Setup friction | Time from clone to first import | < 15 minutes |
| Community adoption | GitHub stars at 6 months | 50+ |
| Extensibility | Community-contributed workflow configs | Any within 12 months |

## Product Scope & Phased Development

### MVP Strategy

**Approach:** Problem-Solving MVP -- solve the specific pain of manual YNAB transaction management for privacy-conscious users, and prove it works reliably.

**Resource:** Solo developer, hobby pace.

**Three MVP Pillars:**

1. **Transaction Import Pipeline** -- Parse bank exports (CSV, OFX, QFX), bulk-import to YNAB with deduplication, payee matching, and format flexibility
2. **AI-Powered Categorization** -- LLM learns from user's YNAB history to suggest/auto-assign categories during import, including split transactions
3. **Full YNAB API as MCP Tools** -- Every endpoint exposed as MCP tools for natural conversational interaction with budget data

**Architectural Principle:** The MCP server provides reliable, stateless tools. Intelligence lives in workflow configuration files that the LLM reads and executes -- similar to BMAD's workflow/step pattern. Extensible without code changes.

**MVP Workflow Configs:**
- Import + categorization workflow
- Post-import reconciliation/verification workflow

**Core Journeys Supported:** First-Time Setup, Weekly Import, Conversational Budget Query

### Must-Have Capabilities

| Capability | Rationale |
|-----------|-----------|
| CSV parsing + auto-detect import | Core value prop -- first-time setup fails without it |
| OFX/QFX parsing | Weekly import requires multi-format -- many banks only export OFX |
| `parse_bank_export` auto-detect tool | UX simplicity -- one tool, any format |
| AI categorization from YNAB history | The differentiator -- without it, this is just bank2ynab |
| Split transaction support | Common real-world need (Costco, Amazon) |
| Bulk transaction creation with deduplication | Reliability promise -- import_id prevents duplicates |
| Reconciliation workflow config | Zero-trust-burden promise requires post-import verification |
| Full YNAB API as MCP tools | Enables conversational budget queries and creative use |
| Workflow config architecture | Enables the "dumb server + smart LLM" pattern |

### Phase 2: Growth

- Receipt-to-transaction (photo scanning with automatic split categorization)
- Community-contributed bank format parsers and workflow configs
- Community contribution documentation and format config directory
- Additional workflow templates (monthly review, budget rebalancing)

### Phase 3: Vision

- Proactive budget insights and anomaly detection
- Subscription drift detection
- Predictive category burn rate analysis
- Cross-category spend correlation
- Budget reallocation recommendations
- Community workflow library

### Risk Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| CSV format variety breaks parsing | High | Start with top 5 US banks (Chase, BofA, Wells, Citi, Amex). Edge cases surface as GitHub issues. |
| OFX/QFX parsing library quality | Medium | Evaluate existing npm packages early. OFX is a defined spec -- less fragmented than CSV. |
| YNAB API rate limit during heavy import | Medium | Batch transaction creation (YNAB supports bulk create). One API call for 50+ transactions. |
| Scope creep (passion project trap) | Medium | MVP is defined. Ship it, use it for a month, then decide what's next. |
| Workflow config pattern is too novel | Low | Tank is the first user. If the pattern works personally, it works for the audience. |

## User Journeys

### Journey 1: First-Time Setup -- "From Clone to Import"

**Meet Alex.** Software engineer, YNAB user for 3 years, manages 6 accounts across two banks and three credit cards. Alex has never connected a single account through Plaid -- every transaction is either hand-entered or imported via downloaded QFX files. Alex already uses Claude Desktop with a few MCP servers for development work.

**Opening Scene:** Alex stumbles across the YNAB MCP Server on GitHub while browsing r/ynab. The README describes exactly the workflow Alex has been doing manually. Stars the repo immediately.

**Rising Action:** Alex clones the repo, runs `npm install`, and adds the server config to Claude Desktop's MCP settings. Grabs a YNAB personal access token from the YNAB developer settings page. Restarts Claude Desktop -- the YNAB tools appear in the tool list. Alex asks Claude: "What budgets do I have access to?" and sees the familiar budget name come back. It's connected.

**Climax:** Alex downloads this week's credit card CSV from Chase, drops it into a local folder, and tells Claude: "Import my Chase transactions from this file into my YNAB credit card account." Claude parses the CSV, pulls Alex's recent YNAB categories and payee history, suggests categories for each transaction -- nailing about 80% on the first try. Alex confirms the suggestions, tweaks a couple, and Claude bulk-imports all 23 transactions. The reconciliation workflow runs automatically: transaction count matches, total matches the statement. Done.

**Resolution:** What used to take Alex 20 minutes of tedious manual work across multiple browser tabs just happened in a 2-minute conversation. Alex goes back to the GitHub repo and writes their first Issue: "This is incredible -- any chance of OFX support too?"

**Requirements revealed:** MCP server configuration, YNAB API authentication, budget/account listing tools, file parsing (CSV), category history retrieval, bulk transaction creation with deduplication, workflow config execution.

### Journey 2: Weekly Import Workflow -- "Tuesday Night Ritual"

**Meet Alex again**, three weeks later. The initial excitement has settled into a routine -- and that's the point.

**Opening Scene:** It's Tuesday evening. Alex opens each bank and credit card website, downloads the week's transaction exports. Five files land in the downloads folder -- two CSVs, two QFX files, one OFX.

**Rising Action:** Alex opens Claude Desktop and says: "I've got this week's bank exports ready to import." Claude knows the drill from the workflow config -- it asks which files, Alex points to the folder. Claude processes them one account at a time: parsing each file, matching the target YNAB account, pulling recent category patterns.

**Climax:** The categorization suggestions are getting better. Alex's spending patterns are consistent -- Costco is always "Groceries," the same gas station every week. Claude suggests categories with 90%+ accuracy now. For a Costco trip that Alex knows was split between groceries and household supplies, Alex says "split that one -- $145 groceries, $62 household" and Claude handles the split transaction. After each account import, the reconciliation workflow confirms the math checks out.

**Resolution:** Five accounts imported, categorized, and reconciled in under 10 minutes. Alex spends the saved time actually reviewing the budget -- noticing that dining out is creeping up this month. The tool has become invisible infrastructure: it just works.

**Requirements revealed:** Multi-file processing, multi-format support (CSV, QFX, OFX), account matching, historical pattern learning for categorization, split transaction support, per-account reconciliation workflow, conversational interaction for corrections.

### Journey 3: Conversational Budget Query -- "Where's My Money Going?"

**Meet Priya.** Financial analyst by day, meticulous personal budgeter by night. Priya has been using the MCP server for two months and has clean, well-categorized data going back years in YNAB.

**Opening Scene:** It's the end of the month. Priya wants to understand spending trends but finds YNAB's built-in reports too rigid. She can see "Spending by Category" but can't ask follow-up questions or cross-reference easily.

**Rising Action:** Priya opens Claude Desktop: "How does my grocery spending this month compare to the last three months? And did dining out go up when groceries went down?" Claude fetches the transaction data via MCP tools, analyzes the patterns, and responds conversationally with specific numbers and the correlation Priya asked about.

**Climax:** Priya asks a question she's never been able to answer in YNAB: "Which of my categories am I consistently under-budget on? Where am I leaving money unallocated?" Claude pulls monthly category data across the last 6 months and identifies three categories where Priya consistently underspends by 20%+ -- money that could be reallocated to her vacation fund.

**Resolution:** Priya makes three budget adjustments in YNAB based on the insights. She's not just tracking spending anymore -- she's optimizing it through conversation. This is the value layer that no other YNAB tool provides.

**Requirements revealed:** Transaction retrieval by category/date range, month-by-month budget data access, category budget amounts, account balance queries -- all exposed as MCP tools that the LLM can orchestrate for analytical conversations.

### Journey 4: Community Contributor -- "Scratching My Own Itch"

**Meet Jordan.** DevOps engineer, YNAB user, and the kind of person who reads source code before installing anything. Jordan banks with a small credit union whose CSV exports have a nonstandard format that the import workflow doesn't handle cleanly.

**Opening Scene:** Jordan's credit union CSV has the date in DD/MM/YYYY format, amounts use parentheses for debits instead of negative signs, and there's an extra header row that trips up parsing. The first import attempt produces mangled dates and wrong amounts.

**Rising Action:** Jordan looks at the workflow config files and realizes the architecture is designed for exactly this situation. The parsing logic isn't hardcoded -- it's guided by configuration. Jordan writes a custom workflow config that handles the credit union's format quirks: date format override, amount parsing rules, header skip count.

**Climax:** Jordan's custom config works. Imports from the credit union now parse perfectly. Jordan forks the repo, adds the config to a "community-formats" directory, and opens a PR with a description: "Added support for [Credit Union Name] CSV format."

**Resolution:** The PR gets merged. Three other users of the same credit union find it and leave thankful comments. The project grows not through the maintainer writing more code, but through the community extending the workflow configs.

**Requirements revealed:** Configurable file parsing (not hardcoded formats), clear workflow config documentation, separation of parsing logic from server code, community contribution path for format configs.

### Journey Requirements Summary

| Capability Area | Journeys | Priority |
|----------------|----------|----------|
| YNAB API authentication & budget access | 1, 2, 3 | MVP |
| File parsing (CSV, OFX, QFX) | 1, 2, 4 | MVP |
| Bulk transaction import with deduplication | 1, 2 | MVP |
| Category history retrieval & AI suggestion | 1, 2 | MVP |
| Split transaction support | 2 | MVP |
| Reconciliation workflow config | 1, 2 | MVP |
| Full YNAB API as MCP tools (read operations) | 3 | MVP |
| Configurable parsing via workflow configs | 4 | MVP |
| Multi-format file support | 2 | MVP |
| Community contribution path for configs | 4 | Growth |

## Domain-Specific Requirements

### Financial Data Accuracy

- All monetary amounts handled in YNAB's milliunit format (multiply by 1000). Conversion must be exact -- no floating point errors.
- Date parsing must handle multiple formats across bank exports (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.) without silent misinterpretation.
- Transaction deduplication via YNAB's import_id mechanism must be reliable -- duplicate imports are unacceptable.
- Payee name normalization must preserve enough detail for user recognition while matching YNAB's existing payee list.

### YNAB API Dependency

- Rate limit: 200 requests per hour per access token. The server must be aware of this constraint and tools should document it.
- API versioning: Built against YNAB API v1 (currently v1.77.0). Monitor for deprecation notices.
- Delta sync: Leverage `server_knowledge` parameter for efficient data fetching rather than full re-reads.
- Error handling: YNAB API errors must surface clearly to the LLM with actionable context, not swallowed silently.

### Privacy by Design

- No telemetry, analytics, or external network calls beyond the YNAB API itself.
- No data persistence beyond what the user explicitly configures -- the server is stateless.
- YNAB personal access token stored in the user's local MCP configuration, never logged or transmitted.
- All processing runs locally on the user's machine.

### What Does NOT Apply

- No PCI-DSS (not handling card data directly)
- No KYC/AML (not a financial service)
- No SOX compliance (not a business)
- No multi-user authentication (single user, local tool)

## Developer Tool Specific Requirements

### Technical Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **Distribution:** npm package
- **MCP Transport:** stdio (standard for local MCP servers with Claude Desktop)
- **MCP SDK:** Official TypeScript MCP SDK
- **YNAB API Client:** `ynab` npm package (official YNAB JavaScript SDK) or direct HTTP calls
- **File Parsing:** Built-in CSV parser + OFX/QFX parsing library (TBD)

### Installation & Configuration

- Install via npm, add server entry to Claude Desktop `claude_desktop_config.json`
- YNAB personal access token provided as environment variable or MCP server argument
- Workflow config files bundled with the package, with a user-accessible directory for custom/community configs
- Target: clone to first successful API call in under 15 minutes

### MCP Tool Surface Area

**Design Philosophy:** Intent-based tool design. Each tool maps to something the user/agent wants to *accomplish*, not to an API endpoint. The workflow configs orchestrate tool sequences; individual tools do meaningful work internally (composing multiple API calls when needed) and return answers, not raw data.

**Target: ~13 tools.** Ecosystem best practice is 5-15. Fewer tools = better LLM performance, less context pressure, clearer intent.

**Naming Convention:** snake_case, action-oriented: `import_transactions`, `search_transactions`, `get_budget_overview`. No service prefix (single-purpose server), but structure supports adding `ynab_` prefix for multi-server environments.

**Import Pipeline Tools (core value):**

| Tool | Intent | What It Does Internally |
|------|--------|------------------------|
| `parse_bank_export` | "Read this bank file" | Auto-detect CSV/OFX/QFX, parse, extract transactions, convert amounts to milliunits, generate import_ids |
| `preview_import` | "Show me what you'd import" | Match parsed transactions against YNAB payee/category history, suggest categories, show dry-run summary |
| `import_transactions` | "Commit these to YNAB" | Bulk-create transactions with dedup via import_id, handle splits |
| `reconcile_import` | "Verify the import was correct" | Compare imported totals/counts against source file, flag mismatches |

**Budget Intelligence Tools (conversational queries):**

| Tool | Intent | What It Does Internally |
|------|--------|------------------------|
| `get_budget_overview` | "What's my financial snapshot?" | Fetches budgets, accounts, category groups -- returns composed summary with balances and health indicators |
| `get_spending_by_category` | "Where's my money going?" | Aggregates transactions by category for a date range, returns totals with budget vs actual |
| `get_monthly_trends` | "How's my spending changing?" | Month-over-month comparison across categories, highlights increases/decreases |
| `search_transactions` | "Find specific transactions" | Flexible search with filters (account, category, payee, date range, amount range) |

**Budget Management Tools (write operations):**

| Tool | Intent | What It Does Internally |
|------|--------|------------------------|
| `create_transaction` | "Add a transaction" | Create single transaction including splits, with payee matching |
| `update_transaction` | "Change this transaction" | Modify existing transaction fields |
| `update_category_budget` | "Adjust my budget" | Update budgeted amount for a category in a specific month |

**System Tools:**

| Tool | Intent | What It Does Internally |
|------|--------|------------------------|
| `list_workflow_configs` | "What workflows are available?" | List bundled + custom workflow config files |
| `read_workflow_config` | "Load this workflow" | Return contents of a specific workflow config file |

**Parameter Design:**
- Flat top-level primitives with Zod schemas -- no nested objects
- Sensible defaults to reduce LLM decision-making (e.g., date range defaults to current month)
- `Literal` enums for constrained choices (e.g., transaction type filters)
- Annotate read tools with `readOnlyHint: true`

**Response Format:**
- Return both human-readable text and structured data via `structuredContent`
- Read tools return composed answers, not raw API payloads -- amounts in both milliunits and human-readable
- Paginate large result sets: `has_more`, `next_offset`, `total_count`

**Error Handling:**
- Structured error objects: `{ code, message, retryable?, retryAfterMs? }`
- Standard codes: `NOT_FOUND`, `INVALID_INPUT`, `UNAUTHORIZED`, `RATE_LIMITED`, `API_ERROR`, `PARSE_ERROR`
- Messages include actionable guidance for the LLM to self-correct or inform the user

### Workflow Configuration Architecture

- Configs stored as markdown/yaml files in a known directory within the package
- Users can add custom configs to a designated directory
- Configs follow a step-based pattern (inspired by BMAD) that the LLM reads and executes
- MVP ships with: import + categorization workflow, post-import reconciliation workflow

### Implementation Considerations

- **Stateless server:** No database, no persistent state. YNAB API is the source of truth.
- **Error transparency:** All YNAB API errors and file parsing errors surface to the LLM with full context for conversational troubleshooting.
- **Milliunit handling:** All amount conversions between human-readable and YNAB milliunit format happen in the tool layer, not left to the LLM.
- **Import ID generation:** Deterministic import_id generation for deduplication -- same file re-imported produces same IDs.

## Functional Requirements

### YNAB API Access

- **FR1:** User can authenticate with the YNAB API using a personal access token
- **FR2:** User can list all budgets associated with their YNAB account
- **FR3:** User can retrieve detailed budget information including accounts, categories, and settings
- **FR4:** User can list all accounts within a budget
- **FR5:** User can retrieve account details and balances
- **FR6:** User can list all categories and category groups within a budget
- **FR7:** User can retrieve category details including budgeted amounts for specific months
- **FR8:** User can update budgeted amounts for a category in a specific month
- **FR9:** User can list all payees within a budget
- **FR10:** User can list all transactions with filtering by account, category, payee, date range, or month
- **FR11:** User can retrieve a single transaction by ID
- **FR12:** User can create one or more transactions (including split transactions) in a budget
- **FR13:** User can update existing transactions
- **FR14:** User can delete a transaction
- **FR15:** User can list scheduled/recurring transactions
- **FR16:** User can retrieve budget month summaries
- **FR17:** User can retrieve the authenticated user's information

### Bank Export File Processing

- **FR18:** User can provide a bank export file (CSV, OFX, or QFX) and have the system auto-detect the format
- **FR19:** System can parse CSV files with varying column layouts, date formats, and amount conventions across financial institutions
- **FR20:** System can parse OFX and QFX files according to the OFX specification
- **FR21:** System can extract transaction records from parsed files including date, amount, payee/description, and any available metadata
- **FR22:** System converts parsed amounts to YNAB milliunit format with exact precision (no floating point errors)
- **FR23:** System generates deterministic import_id values for parsed transactions to enable deduplication on re-import

### Transaction Import & Categorization

- **FR24:** User can bulk-import parsed transactions into a specified YNAB budget and account
- **FR25:** System deduplicates transactions during import using YNAB's import_id mechanism
- **FR26:** User can receive AI-suggested category assignments based on their existing YNAB transaction history and payee patterns
- **FR27:** User can accept, modify, or reject suggested categories before import
- **FR28:** User can create split transactions during import (assigning portions of a single transaction to multiple categories)
- **FR29:** System matches imported payee names against existing YNAB payees for consistency

### Workflow Configuration

- **FR30:** System ships with built-in workflow configuration files that the LLM can read and follow
- **FR31:** System provides an import + categorization workflow config that guides the LLM through the full import process
- **FR32:** System provides a post-import reconciliation workflow config that verifies transaction counts and totals against the source file
- **FR33:** User can add custom workflow configuration files to a designated directory
- **FR34:** Workflow configs are readable markdown/yaml files that define step-by-step processes for the LLM to execute

### Budget Data Querying

- **FR35:** User can query transaction data conversationally through the LLM using exposed MCP tools
- **FR36:** User can retrieve spending data across categories and time periods for analysis
- **FR37:** User can compare budget performance across months
- **FR38:** User can identify underspent and overspent categories across time periods

### Error Handling & Transparency

- **FR39:** System surfaces YNAB API errors to the LLM with actionable context (error type, affected resource, suggested resolution)
- **FR40:** System surfaces file parsing errors with specific details (line number, malformed data, expected vs actual format)
- **FR41:** System reports YNAB API rate limit status so the LLM can inform the user or pace requests

## Non-Functional Requirements

### Security & Privacy

- **NFR1:** YNAB personal access token must never appear in log output, error messages, or tool responses
- **NFR2:** No network calls beyond the YNAB API (api.ynab.com) -- no telemetry, analytics, or external services
- **NFR3:** No persistent storage of financial data -- server is stateless; YNAB API is the sole source of truth
- **NFR4:** Sensitive data (token, transaction amounts) must not be written to disk by the server process

### Reliability & Data Integrity

- **NFR5:** Transaction import must produce 100% accurate results -- correct amounts, dates, payees, and deduplication. No silent data loss or corruption.
- **NFR6:** Milliunit conversion must use integer arithmetic, not floating point, to prevent rounding errors
- **NFR7:** Import_id generation must be deterministic -- re-importing the same file must produce the same IDs
- **NFR8:** File parsing failures must fail explicitly with clear error context rather than silently producing partial or incorrect results

### Integration

- **NFR9:** Server must operate correctly against YNAB API v1 (currently v1.77.0)
- **NFR10:** Server must handle YNAB API rate limiting gracefully -- report remaining quota to the LLM rather than silently failing
- **NFR11:** Server must support the MCP protocol over stdio transport for Claude Desktop compatibility
- **NFR12:** Server must leverage YNAB's server_knowledge delta sync for efficient data retrieval where supported

### Developer Experience

- **NFR13:** Setup from clone to first successful API call must be achievable in under 15 minutes with documentation
- **NFR14:** Error messages must include enough context for the LLM to troubleshoot conversationally (not generic "request failed" messages)
- **NFR15:** Workflow config files must be human-readable and editable without specialized tools
