# Adversarial Review Findings - Import Pipeline Enhancements

**Review Date:** 2026-03-14
**Reviewers:** Blind Hunter, Edge Case Hunter, Acceptance Auditor
**Total Findings:** 15 (3 Critical, 4 High, 5 Medium, 3 Low)

---

## CRITICAL ISSUES (Blocking)

### 1. Uninitialized Variable in preview-import.ts
**Category:** PATCH (Logic error in implementation)
**Severity:** CRITICAL - Runtime crash
**Files:** `src/tools/preview-import.ts` lines 42-48

```typescript
// CURRENT (BROKEN):
let filteredTransactions = transactions;  // ❌ Missing this line
let filteredCount = 0;
if (since_date) {
  filteredTransactions = transactions.filter((t) => t.date >= since_date);
  filteredCount = transactions.length - filteredTransactions.length;
}
// Line 77: previews = filteredTransactions.map(...) → CRASHES if since_date is falsy
```

**Issue:** When `since_date` is not provided (undefined), `filteredTransactions` is never initialized, causing ReferenceError on line 77.

**Fix:** Initialize `filteredTransactions = transactions` BEFORE the if block:
```typescript
let filteredTransactions = transactions;  // Provide default
let filteredCount = 0;
if (since_date) {
  filteredTransactions = transactions.filter((t) => t.date >= since_date);
  filteredCount = transactions.length - filteredTransactions.length;
}
```

---

### 2. Identical Variable Initialization Issue in import-transactions.ts
**Category:** PATCH
**Severity:** CRITICAL - Runtime crash
**Files:** `src/tools/import-transactions.ts` lines 56-62

**Issue:** Same as #1 - `filteredTransactions` not initialized before conditional, causing ReferenceError on line 64.

**Fix:** Same pattern - initialize before if block:
```typescript
let filteredTransactions = transactions;  // Provide default
let filteredCount = 0;
if (since_date) {
  filteredTransactions = transactions.filter((t) => t.date >= since_date);
  filteredCount = transactions.length - filteredTransactions.length;
}
```

---

### 3. Division by Zero in preview-import.ts
**Category:** PATCH
**Severity:** CRITICAL
**Files:** `src/tools/preview-import.ts` line 130

```typescript
// CURRENT (BROKEN):
md += `- **Categorized:** ${matched} (${Math.round((matched / filteredTransactions.length) * 100)}%)\n`;
// When filteredTransactions.length === 0, division by zero → NaN%
```

**Issue:** If all transactions are filtered by `since_date`, `filteredTransactions.length = 0`, causing NaN in percentage output.

**Fix:** Add guard:
```typescript
const categorizedPercent = filteredTransactions.length > 0
  ? Math.round((matched / filteredTransactions.length) * 100)
  : 0;
md += `- **Categorized:** ${matched} (${categorizedPercent}%)\n`;
```

---

### 4. Missing JSON Extension Support in detectFormat.ts
**Category:** PATCH
**Severity:** CRITICAL
**Files:** `src/parsers/detect-format.ts` lines 14-23

**Issue:** `detectFormat()` doesn't recognize `.json` extension or JSON content, so JSON files fail with "unsupported format" error.

**Fix:** Add JSON extension check:
```typescript
const ext = extname(filePath).toLowerCase();
if (ext === ".ofx") return "ofx";
if (ext === ".qfx") return "qfx";
if (ext === ".csv") return "csv";
if (ext === ".json") return "json";  // ADD THIS

// Later, also check for JSON content markers:
if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
  return "json";
}
```

---

## HIGH SEVERITY ISSUES (Strongly Recommended)

### 5. since_date Format Not Validated
**Category:** PATCH
**Severity:** HIGH
**Files:** `src/tools/preview-import.ts` line 30-33, `src/tools/import-transactions.ts` line 44-47

**Issue:** Zod schema accepts `since_date` as any string, no format validation. Invalid dates like "01/15/2026" or "abc" pass validation and cause incorrect filtering.

**Fix:** Add regex validation to Zod schema:
```typescript
since_date: z
  .string()
  .optional()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .describe("Only include transactions on or after this date (YYYY-MM-DD format)")
```

---

### 6. Empty Filtered Array Sent to YNAB API
**Category:** PATCH
**Severity:** HIGH
**Files:** `src/tools/import-transactions.ts` line 70-72

**Issue:** When all transactions are filtered by `since_date`, empty array is sent to YNAB API. API behavior is undefined for empty requests.

**Fix:** Add early return if no transactions after filtering:
```typescript
if (filteredTransactions.length === 0) {
  return formatToolResponse("## Import Complete\n\nNo transactions to import (all filtered by since_date).", {
    created_count: 0,
    duplicate_count: 0,
    filtered_count: filteredCount,
    total_submitted: 0,
    total_amount: 0,
    transaction_ids: [],
    duplicate_import_ids: [],
  });
}
```

---

### 7. Format "unknown" Bypasses Validation
**Category:** PATCH
**Severity:** HIGH
**Files:** `src/tools/parse-bank-export.ts` lines 133-145

**Issue:** If `format_hint="unknown"` is passed with content, validation doesn't catch it. The else clause attempts to route to OFX parser with invalid format.

**Fix:** Add explicit validation that when `content` is provided, `format_hint` must be one of the supported formats:
```typescript
if (content && (!format_hint || format_hint === "auto" || format_hint === "unknown")) {
  // error: format_hint is required and must be csv/ofx/qfx/json
}
```

---

### 8. Whitespace-Only since_date Passes Validation
**Category:** PATCH
**Severity:** HIGH
**Files:** `src/tools/preview-import.ts`, `src/tools/import-transactions.ts`

**Issue:** since_date=" " (space only) passes validation. String comparison `t.date >= " "` gives unexpected results.

**Fix:** The YYYY-MM-DD regex validation (issue #5) will solve this.

---

## MEDIUM SEVERITY ISSUES

### 9. Size Limit Uses Character Count, Not Bytes
**Category:** PATCH
**Severity:** MEDIUM
**Files:** `src/tools/parse-bank-export.ts` line 113

**Issue:** `content.length` counts UTF-16 code units, not actual byte size. Multi-byte UTF-8 characters can exceed intended 5MB byte limit.

**Fix:** Consider clarifying in comments or converting to byte-based validation if strict 5MB binary limit is needed. For now, add comment:
```typescript
// Note: .length counts UTF-16 code units, not bytes. Actual byte size may vary.
if (content && content.length > CONTENT_SIZE_LIMIT) {
```

---

### 10. No Null Check on Transaction Dates
**Category:** PATCH
**Severity:** MEDIUM
**Files:** `src/tools/preview-import.ts` line 46, `src/tools/import-transactions.ts` line 60

**Issue:** If any transaction has `date = null/undefined`, string comparison `t.date >= since_date` gives unexpected results.

**Fix:** Add type guard (assuming ParsedTransaction always has valid dates, but good defensive coding):
```typescript
if (since_date) {
  filteredTransactions = transactions.filter((t) => t.date && t.date >= since_date);
```

---

### 11. Empty Input Transactions Not Validated
**Category:** PATCH
**Severity:** MEDIUM
**Files:** `src/tools/preview-import.ts` line 77, `src/tools/import-transactions.ts` line 64

**Issue:** If `transactions.length === 0`, both tools proceed. `preview-import` crashes on division by zero. `import-transactions` sends empty array to API.

**Fix:** Add early validation:
```typescript
if (filteredTransactions.length === 0) {
  return formatToolResponse("## Import Preview\n\nNo transactions to preview.", {
    total_count: 0,
    filtered_count: filteredCount,
    total_amount: 0,
    categorized_count: 0,
    uncategorized_count: 0,
    previews: [],
  });
}
```

---

## LOW SEVERITY ISSUES

### 12. JSON Parser Null Handling
**Category:** PATCH
**Severity:** LOW
**Files:** `src/parsers/json-parser.ts` line 59

**Issue:** Generic error message for `{ "transactions": null }`. Could be more specific.

**Fix:** Already has reasonable error handling; low priority.

---

### 13. Format Mismatch Not Detected
**Category:** PATCH
**Severity:** LOW
**Files:** `src/tools/parse-bank-export.ts` line 164-175

**Issue:** If user provides `format_hint="csv"` but content is actually JSON, wrong parser is called. No format validation/detection.

**Fix:** Low priority - user provided explicit hint, should be trusted. Document as expected behavior.

---

### 14. Test Coverage Gaps
**Category:** PATCH
**Severity:** MEDIUM (affects acceptance)
**Files:** All test files

**Issue:** No tool-level integration tests for:
- parse-bank-export content mode validation
- Mutual exclusivity error handling
- format_hint requirement

**Fix:** Add more comprehensive tool-level tests with mocked MCP server.

---

## CLASSIFICATION SUMMARY

| Category | Count | Issues |
|----------|-------|--------|
| **PATCH** | 14 | #1-4, #5-13, #14 |
| **INTENT_GAP** | 0 | None |
| **BAD_SPEC** | 0 | None |
| **DEFER** | 1 | Test framework improvements |
| **REJECT** | 0 | None |

---

## NEXT STEPS

All 14 issues are **PATCH** (fixable without spec revision). Recommend:
1. Fix critical issues #1-4 immediately (runtime crashes)
2. Fix high-severity issues #5-8 (data integrity)
3. Fix medium issues #9-11 (robustness)
4. Fix low issues #12-13 (nice-to-have)
5. Defer test infrastructure improvements (#14)

Total estimated fix time: 30-45 minutes
Risk of regression: Low (all fixes are additive validation)
