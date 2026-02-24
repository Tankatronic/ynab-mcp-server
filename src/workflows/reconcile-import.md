# Post-Import Reconciliation Workflow

Verify that an import completed correctly by comparing source data against YNAB.

## When to Use

Run this workflow after completing an import to verify accuracy. This is especially important for:
- First-time imports from a new bank
- Large imports (50+ transactions)
- When the import-categorize workflow reports any warnings

## Steps

### Step 1: Gather Import Summary

You should already have these values from the import process:
- **Source transaction count** (from `parse_bank_export`)
- **Source total amount** (from `parse_bank_export`)
- **Imported count** (from `import_transactions`)
- **Duplicate count** (from `import_transactions`)
- **Import total amount** (same as source total if all transactions were submitted)

### Step 2: Run Reconciliation Check

Call `reconcile_import` with the gathered values.

### Step 3: Investigate Mismatches (if any)

**Count mismatch:**
1. Check parse warnings for skipped rows (bad dates, missing amounts)
2. Check if some transactions were duplicates from a previous import
3. Call `search_transactions` for the target account with the import date range to see what's actually in YNAB

**Amount mismatch:**
1. Check if amount signs are inverted (some banks use opposite conventions)
2. Look for rounding differences (should not happen with milliunit conversion)
3. Compare individual transaction amounts between source and YNAB

### Step 4: Report Results

Summarize for the user:
- Whether all checks passed
- Any discrepancies found and their likely causes
- Recommended actions (re-import with different settings, manual correction, etc.)
