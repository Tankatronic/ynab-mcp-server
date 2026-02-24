# Import & Categorize Workflow

Guide the user through importing a bank export file into YNAB with AI-assisted categorization.

## Prerequisites

- User has a bank export file (CSV, OFX, or QFX)
- User knows which YNAB account to import into

## Steps

### Step 1: Parse the Bank Export

Call `parse_bank_export` with the file path provided by the user.

- If the format is not detected, ask the user for a format hint
- If column mapping fails for CSV, ask the user to provide column names
- Report the number of transactions found and any warnings

### Step 2: Identify the Target Account

If the user hasn't specified a YNAB account:

1. Call `get_budget_overview` to list available accounts
2. If the parsed file includes an account name/number, try to match it
3. Ask the user to confirm or select the correct account

### Step 3: Preview with Category Suggestions

Call `preview_import` with the parsed transactions and the target account.

- Present the categorization suggestions to the user
- Highlight any uncategorized transactions
- Ask the user to confirm or adjust categories
- For transactions the user wants to split, collect the split details

### Step 4: Import Transactions

After the user confirms the preview:

Call `import_transactions` with the finalized transactions (including any category changes and splits the user requested).

- Report the number of created vs skipped (duplicate) transactions

### Step 5: Reconcile

Call `reconcile_import` with:
- Source transaction count and total from Step 1
- Created count and duplicate count from Step 4
- The total amount from the import

Report whether all checks passed. If there are mismatches, help the user investigate.

## Error Handling

- If `parse_bank_export` fails, suggest checking the file format or providing column mapping hints
- If `preview_import` fails with UNAUTHORIZED, ask the user to check their YNAB_API_TOKEN
- If `import_transactions` returns rate limit errors, wait and retry
- If reconciliation shows mismatches, review the parse warnings for skipped rows
