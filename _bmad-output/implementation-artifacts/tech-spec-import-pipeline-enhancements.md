---
title: 'Import Pipeline Enhancements: Raw Content Parsing & Date Filtering'
type: 'feature'
created: '2026-03-14'
status: 'done'
baseline_commit: '2db660847403a37fa24c71403ec8a0714e7ac6ef'
context: []
---

# Import Pipeline Enhancements: Raw Content Parsing & Date Filtering

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `parse_bank_export` requires a filesystem path, but AI assistant environments upload files to inaccessible paths (e.g., `/mnt/user-data/uploads/`), blocking the primary import workflow. Additionally, importing bank exports that overlap with existing YNAB data produces noisy previews and wasted API calls, since all transactions are processed even when older ones are already imported.

**Approach:** Add an optional `content` string parameter to `parse_bank_export` so raw file data can be passed directly. Add an optional `since_date` filter to `preview_import` and `import_transactions` to skip transactions before a cutoff date.

## Boundaries & Constraints

**Always:** Backward compatible — existing `file_path` usage must not change. Validate mutual exclusivity of `content` vs `file_path`. Report filtered transaction counts in output. Content size limit: 5MB. When `content` is provided, `format_hint` is required (must be "csv", "ofx", "qfx", or "json").

**Never:** Change the ParsedTransaction interface. Alter existing parser logic (CSV/OFX). Remove or rename existing parameters.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Content-only CSV | `content` = valid CSV string, no `file_path` | Parsed transactions returned | N/A |
| Content-only OFX | `content` = valid OFX string, no `file_path` | Parsed transactions returned | N/A |
| Content-only JSON | `content` = valid JSON string, no `file_path` | Parsed transactions returned | N/A |
| File-path-only | `file_path` = valid path, no `content` | Existing behavior unchanged | N/A |
| Both provided | `content` + `file_path` both set | Validation error | `INVALID_INPUT: Provide either file_path or content, not both` |
| Neither provided | No `content`, no `file_path` | Validation error | `INVALID_INPUT: Either file_path or content is required` |
| Content too large | `content` > 5MB | Validation error | `CONTENT_TOO_LARGE: Content exceeds 5MB limit` |
| Content missing format hint | `content` provided, no `format_hint` | Validation error | `INVALID_INPUT: format_hint is required when using content` |
| since_date filters all | `since_date` = future date | Empty results with `filtered_count` shown | N/A |
| since_date filters some | `since_date` between oldest/newest transaction | Subset returned, `filtered_count` in output | N/A |
| since_date absent | No `since_date` | All transactions processed (existing behavior) | N/A |

</frozen-after-approval>

## Code Map

- `src/tools/parse-bank-export.ts` -- Tool definition with Zod schema, orchestrates parsing (add content param, route to json parser)
- `src/parsers/csv-parser.ts` -- `parseCsvContent()` operates on string content (no changes)
- `src/parsers/ofx-parser.ts` -- `parseOfxContent()` operates on string content (no changes)
- `src/parsers/json-parser.ts` -- `parseJsonContent()` for JSON format (new file to create)
- `src/parsers/types.ts` -- `ParsedTransaction`, `ParseResult`, `FileFormat` types (update FileFormat to include "json")
- `src/tools/preview-import.ts` -- Preview tool with Zod schema, category matching (add since_date filtering)
- `src/tools/import-transactions.ts` -- Import tool with Zod schema, YNAB API call (add since_date filtering)
- `src/tools/parse-bank-export.test.ts` -- Tests for parse tool (add content mode tests)
- `src/tools/preview-import.test.ts` -- Tests for preview tool (add since_date tests)
- `src/tools/import-transactions.test.ts` -- Tests for import tool (add since_date tests)

## Tasks & Acceptance

**Execution:**
- [ ] `src/parsers/types.ts` -- Update `FileFormat` type to include "json".
- [ ] `src/parsers/json-parser.ts` -- Create JSON parser that reads transactions from JSON content. Must produce same `ParseResult` format as CSV/OFX parsers. Expected JSON schema: array of objects with `date`, `amount`, `payee`, `memo` fields (or similar field mappings).
- [ ] `src/parsers/detect-format.ts` -- No changes (format_hint is required when using content, so no content-based detection needed).
- [ ] `src/tools/parse-bank-export.ts` -- Make `file_path` optional in Zod schema. Add `content` (optional string). Add validation: exactly one of `file_path`/`content` must be provided; content size <= 5MB; when `content` is provided, `format_hint` is required and must be "csv", "ofx", "qfx", or "json". When `content` is provided, pass content directly to parsers instead of reading from filesystem. Route to appropriate parser based on format_hint (csv, ofx, json).
- [ ] `src/tools/preview-import.ts` -- Add optional `since_date` (string, YYYY-MM-DD) to Zod schema. Filter `transactions` array before processing. Include `filtered_count` in markdown and JSON response.
- [ ] `src/tools/import-transactions.ts` -- Add optional `since_date` (string, YYYY-MM-DD) to Zod schema. Filter `transactions` array before YNAB API call. Include `filtered_count` in markdown and JSON response.
- [ ] `src/tools/parse-bank-export.test.ts` -- Add tests for content-mode parsing: valid CSV content, valid OFX content, valid JSON content, both-provided error, neither-provided error, content-too-large error, missing-format-hint error.
- [ ] `src/parsers/json-parser.test.ts` -- Add tests for JSON parser with valid transaction arrays, field mapping variations, and error handling for invalid JSON.
- [ ] `src/tools/import-transactions.test.ts` -- Add tests for `since_date` filtering: filters correctly, absent means no filter.

**Acceptance Criteria:**
- Given raw CSV content passed via `content` param, when `parse_bank_export` is called, then transactions are parsed identically to file-based parsing
- Given raw JSON content passed via `content` param with `format_hint="json"`, when `parse_bank_export` is called, then transactions are parsed from JSON
- Given both `content` and `file_path` provided, when `parse_bank_export` is called, then a clear validation error is returned
- Given `since_date` is set on `preview_import`, when transactions span before and after the date, then only transactions on or after `since_date` are previewed and `filtered_count` reflects the excluded count
- Given `since_date` is set on `import_transactions`, when transactions span before and after the date, then only transactions on or after `since_date` are imported and `filtered_count` reflects the excluded count
- Given no `since_date` provided, when either tool is called, then all transactions are processed (backward compatible)

## Verification

**Commands:**
- `npm run build` -- expected: no TypeScript errors
- `npm run test` -- expected: all tests pass including new ones
- `npm run lint` -- expected: no lint errors
