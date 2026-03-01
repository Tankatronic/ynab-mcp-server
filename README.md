# ynab-mcp-server

An [MCP server](https://modelcontextprotocol.io/) that lets you manage your YNAB budget through natural language — import bank files, categorize transactions, and ask questions about your spending.

**Built for YNAB users who don't link their bank accounts.** If you prefer to manually import transactions instead of connecting your financial accounts to third-party services, this tool removes the tedious parts. Export a file from your bank, tell your AI assistant to import it, and you're done.

Unlike YNAB's built-in file import — which requires CSVs to be [reformatted to a specific layout](https://support.ynab.com/en_us/formatting-a-csv-file-an-overview-BJvczkuRq) — this server works with your bank's CSV exports directly. It auto-detects formats from major US banks and handles column mapping, date parsing, and amount sign conventions automatically.

Your financial data stays on your machine. The only external call is to the official YNAB API using your personal access token — no data aggregators, no third-party services.

## Quick Start

### 1. Get a YNAB token

Go to [YNAB Developer Settings](https://app.ynab.com/settings/developer) and create a personal access token.

### 2. Configure your MCP client

Add the server to your MCP client config. Here's an example for Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "ynab": {
      "command": "npx",
      "args": ["-y", "@tankatronic/ynab-mcp-server"],
      "env": {
        "YNAB_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

This works with any MCP-compatible client — see the [MCP client directory](https://modelcontextprotocol.io/clients) for other options.

### 3. Restart your client and try it

> "Import my Chase transactions from ~/Downloads/chase-feb-2026.csv into my checking account"

The server will parse the file, suggest categories based on your recent transaction history, and let you review before importing anything into YNAB.

## What You Can Do

### Import bank files

Drop a CSV, OFX, or QFX export and let the server handle parsing and categorization. Auto-detects formats from Chase, Bank of America, Wells Fargo, American Express, and Citi. Any other bank works with explicit column mapping.

```
"Import ~/Downloads/amex-statement.csv into my Amex account"
```

Importing the same file twice is safe — each transaction gets a deterministic ID, and YNAB skips anything already imported.

### Get category suggestions

When previewing an import, the server looks up your recent YNAB history and suggests categories by matching payee names to how you've categorized them before. You review and adjust before anything is committed.

### Split transactions

A single transaction can be split across categories — groceries and household supplies on the same Costco receipt, for example.

### Ask about your budget

```
"How does my grocery spending compare to the last 3 months?"
"Which categories are consistently underspent?"
"Show me all Amazon transactions over $50 this year"
```

### Use guided workflows

The server ships with step-by-step workflow configs that walk your AI assistant through multi-step processes like importing and reconciling:

```
"List available workflows"
"Run the import-categorize workflow"
```

You can add your own by setting `YNAB_MCP_WORKFLOWS_DIR` to a directory of markdown workflow files.

## Tools

| Tool | What it does |
|------|-------------|
| `parse_bank_export` | Parse a CSV, OFX, or QFX file |
| `preview_import` | Dry-run an import with category suggestions |
| `import_transactions` | Bulk-import with automatic deduplication |
| `reconcile_import` | Verify imported totals match the source file |
| `get_budget_overview` | Show accounts, balances, and category group totals |
| `get_spending_by_category` | Budgeted vs. actual for a given month |
| `get_monthly_trends` | Compare spending across months (up to 12) |
| `search_transactions` | Filter by account, category, payee, date, or amount |
| `create_transaction` | Create a transaction, optionally with splits |
| `update_transaction` | Edit an existing transaction |
| `update_category_budget` | Change the budgeted amount for a category |
| `list_workflow_configs` | List available workflow configs |
| `read_workflow_config` | Load a workflow config |

## Supported Bank Formats

**Auto-detected CSV layouts:**
- Chase (credit card and checking)
- Bank of America
- Wells Fargo
- American Express
- Citi

**Also supported:**
- OFX and QFX files (most banks offer this export)
- Any CSV with a custom `column_mapping` parameter

Don't see your bank? The `parse_bank_export` tool accepts explicit column mapping.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22 LTS
- Any [MCP-compatible client](https://modelcontextprotocol.io/clients)
- A [YNAB personal access token](https://app.ynab.com/settings/developer)

## Development

```bash
git clone https://github.com/Tankatronic/ynab-mcp-server.git
cd ynab-mcp-server
npm install
npm test          # run tests
npm run build     # compile TypeScript
npm run lint      # type-check
```

To use a local build with your MCP client, point it at the built entry point:

```json
{
  "mcpServers": {
    "ynab": {
      "command": "node",
      "args": ["/absolute/path/to/ynab-mcp-server/dist/index.js"],
      "env": {
        "YNAB_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Contributing

Issues and PRs welcome — especially:
- Bank CSV format profiles for new banks
- Workflow config files for common use cases
- Bug reports with anonymized sample bank files

## License

MIT
