# ynab-mcp-server

An MCP server for AI-powered YNAB budget management. Parse bank exports, bulk-import transactions with AI category suggestions, and query your budget conversationally — all running locally, with no third-party data aggregators.

## What it does

- **Import bank exports** — drop a CSV, OFX, or QFX file and let the LLM parse, categorize, and import it into YNAB in one conversation
- **AI categorization** — suggests categories based on your existing YNAB transaction history; learns your patterns
- **Deduplication** — deterministic import IDs mean re-importing the same file is always safe
- **Split transactions** — Costco run split between groceries and household? No problem
- **Conversational budget queries** — ask natural language questions about spending, trends, and category health
- **Full YNAB API access** — create, update, and search transactions; adjust budgets; all 13 tools

Privacy-first: your financial data never leaves your machine or passes through third-party services.

## Prerequisites

- [Claude Desktop](https://claude.ai/download)
- [Node.js](https://nodejs.org/) >= 22 LTS
- A [YNAB personal access token](https://app.ynab.com/settings/developer)

## Setup

**1. Add to Claude Desktop config**

Open `claude_desktop_config.json`:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

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

**2. Restart Claude Desktop**

The YNAB tools will appear in Claude's tool list.

**3. Test it**

Ask Claude: *"What budgets do I have access to?"*

## Usage

### Import a bank file

```
"Import my Chase transactions from ~/Downloads/chase-jan-2026.csv into my Visa account"
```

Claude will parse the file, suggest categories based on your history, let you confirm or adjust, then bulk-import and reconcile.

### Query your budget

```
"How does my grocery spending this month compare to the last 3 months?"
"Which categories am I consistently underspending?"
"Find all transactions over $100 at Amazon this year"
```

### Workflow configs

The server ships with step-by-step workflow configs that guide Claude through multi-step processes:

```
"List available workflows"
"Load the import-categorize workflow"
```

Custom workflows can be added by setting `YNAB_MCP_WORKFLOWS_DIR` in your environment.

## Available Tools

| Tool | Description |
|------|-------------|
| `parse_bank_export` | Parse CSV, OFX, or QFX bank export files |
| `preview_import` | Dry-run with AI category suggestions |
| `import_transactions` | Bulk-import with deduplication |
| `reconcile_import` | Verify import accuracy |
| `get_budget_overview` | Accounts, balances, category group totals |
| `get_spending_by_category` | Budgeted vs actual by category for a month |
| `get_monthly_trends` | Month-over-month comparison |
| `search_transactions` | Filter by account, category, payee, date, amount |
| `create_transaction` | Add a transaction (supports splits) |
| `update_transaction` | Modify an existing transaction |
| `update_category_budget` | Adjust a category's budgeted amount |
| `list_workflow_configs` | List available workflow configs |
| `read_workflow_config` | Load a workflow config for Claude to follow |

## Supported Bank Formats

**Auto-detected CSV layouts:**
- Chase (credit card and checking)
- Bank of America
- Wells Fargo
- American Express
- Citi

**Other formats:**
- OFX / QFX (most banks support this export)
- Any CSV with custom column mapping via `column_mapping` parameter

Don't see your bank? The `parse_bank_export` tool accepts explicit column mapping. Community-contributed format configs welcome.

## Development

```bash
git clone https://github.com/Tankatronic/ynab-mcp-server.git
cd ynab-mcp-server
npm install
npm test          # run tests
npm run build     # compile TypeScript
npm run lint      # type check
```

**Use local build with Claude Desktop:**

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

## Contributing

Issues and PRs welcome — especially:
- Bank CSV format profiles
- Workflow config files for common use cases
- Bug reports with sample (anonymized) bank files

## License

MIT
