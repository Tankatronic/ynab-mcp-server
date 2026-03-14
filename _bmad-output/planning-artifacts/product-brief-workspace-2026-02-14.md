---
stepsCompleted: [1, 2, 3]
inputDocuments: []
date: 2026-02-14
author: Tank
---

# Product Brief: YNAB MCP Server

## Executive Summary

YNAB MCP Server is an open-source Model Context Protocol server that enables AI-powered management of YNAB (You Need A Budget) without requiring users to connect their financial institutions through third-party aggregators like Plaid or MX. It provides a privacy-first approach to budget automation by allowing users to export transactions from their financial institutions and import them through AI tools, while also enabling intelligent features like receipt scanning with automatic category splitting, smart auto-categorization, and conversational budget insights. The server runs locally on the user's machine and integrates with Claude Desktop or other MCP-capable AI tools.

---

## Core Vision

### Problem Statement

YNAB users who value financial privacy face a painful choice: either connect their accounts through third-party data aggregators (Plaid, MX) that collect financial data, or manage transactions manually. While YNAB does support file-based import (drag-and-drop of OFX, QFX, CSV files), the overall workflow of logging into multiple institutions, downloading exports, importing them, and then categorizing everything -- especially split transactions -- remains tedious. For a household managing many accounts across different banks, credit unions, and credit card issuers, this friction leads to falling behind, abandoning the manual approach, or ultimately giving in and connecting accounts despite privacy concerns.

### Problem Impact

- Users with privacy concerns avoid YNAB's auto-sync, losing the tool's primary convenience feature
- Manual transaction entry and even file-based import across many accounts is time-consuming and repetitive
- Split transactions (e.g., a single Costco receipt spanning groceries, home goods, and garden supplies) are particularly painful to categorize correctly
- Without streamlined automation, users fall behind on categorization and lose the budgeting insights YNAB provides
- The friction leads to inconsistent usage, undermining YNAB's "give every dollar a job" methodology -- or worse, pushing users to connect their accounts despite their privacy preferences

### Why Existing Solutions Fall Short

The YNAB ecosystem has a variety of community tools, but no single solution combines AI intelligence, receipt parsing, conversational insights, and streamlined import into one privacy-first MCP package. Each existing tool solves at most one or two dimensions of the problem:

| Tool | Type | What It Does | Key Gap |
|------|------|-------------|---------|
| **rgarcia/ynab-mcp-server** | MCP Server (Python) | Auto-generated ~45-line wrapper exposing the full YNAB API as MCP tools via FastMCP | No intelligence layer, no file parsing, no receipt scanning -- raw API proxy |
| **calebl/ynab-mcp-server** | MCP Server (TypeScript) | Hand-crafted curated YNAB tools with guided workflows (budget setup, overspent management) | No AI intelligence, no receipt parsing, no CSV import pipeline |
| **YNAB_GPT + YNAB_AMAZON** | Python CLI + Cron | Auto-categorizes uncategorized transactions via ChatGPT; parses Amazon HTML receipts into split transactions | Batch-only cron job, Amazon-only receipts, no MCP integration, no budget insights |
| **bank2ynab** | Python CLI | Converts 50+ bank CSV formats to YNAB-compatible format with optional API import | No intelligence -- purely mechanical column mapping, no categorization |
| **Snapt** | SaaS (Telegram Bot) | AI receipt scanner -- photos to split transactions with multi-model AI support | Telegram-only, SaaS not self-hosted, receipt parsing only, not privacy-first |

The Toolkit for YNAB browser extension deserves mention as a complementary tool -- it adds 100+ features to the YNAB web app (custom reports, reconciliation assistance, Sankey diagrams) but operates entirely within the browser and cannot import transactions, automate workflows, or provide AI-powered analysis. A user would likely use both.

### Proposed Solution

A purpose-built MCP server that transforms the manual YNAB workflow through AI intelligence:

1. **Transaction Import Pipeline** -- Parse exported files (CSV, OFX, QFX) from any financial institution and bulk-import them into YNAB with proper formatting, deduplication via import_id, and payee matching
2. **Receipt-to-Transaction** -- Send a photo of a receipt and have AI parse it, identify line items, map them to YNAB categories, and create split transactions automatically
3. **Smart Auto-Categorization** -- Learn from the user's YNAB history and patterns to suggest or auto-assign categories for imported transactions
4. **Conversational Budget Intelligence** -- Query and analyze YNAB data through natural conversation, surfacing insights beyond what YNAB's built-in reports provide
5. **YNAB API Access** -- Expose the YNAB API endpoints as needed to support the above intelligence features (not a goal unto itself -- build only what the smart tools require)

### AI-Powered Insights Differentiation

YNAB's built-in reporting is limited to four backward-looking views: Spending Trends, Net Worth, Income vs. Expense, and Age of Money. The MCP server can provide differentiated intelligence using data the YNAB API already exposes:

| Insight | What You'd Ask | Why YNAB Can't Do This |
|---------|---------------|----------------------|
| **Cross-category spend correlation** | "When Groceries goes up, does Dining Out go down, or do both spike together?" | YNAB treats categories as islands -- no relational analysis |
| **Predictive category burn rate** | "Based on my pace so far, which categories will I overshoot this month?" | No intra-month pacing, no projection against historical spending curves |
| **Subscription anomaly detection** | "Have any of my recurring bills or subscriptions changed in price?" | No drift detection across recurring payee transactions over time |
| **Year-over-year seasonal comparison** | "How does this December compare to last December? Are holidays getting more expensive?" | No side-by-side temporal overlay or multi-year comparison |
| **Budget reallocation recommendations** | "Where am I consistently leaving money on the table? What should I reallocate?" | Shows underspend as a green bubble but never advises on optimization |
| **Multi-account cash flow timing** | "When in the month am I tightest across all my accounts?" | No intra-month daily cash position model across multiple accounts |

### Key Differentiators

- **Privacy-first design** -- Built specifically for users who refuse to connect accounts through third-party aggregators. All processing runs locally on the user's machine.
- **Intelligence layer, not just a wrapper** -- Smart categorization, receipt parsing, and proactive budget insights that no existing solution provides in a unified package
- **Open source and self-hosted** -- Users maintain complete control; hosted on GitHub for the privacy-conscious YNAB community to self-host
- **Proven API foundation** -- Built on YNAB's official API with full support for split transactions, bulk import, and deduplication (validated through working proof of concept)
- **AI-native workflow** -- Designed from the ground up for conversational interaction via Claude Desktop and MCP-capable AI tools
- **Non-destructive coexistence** -- Works alongside direct YNAB usage. Users can continue entering transactions, categorizing, and using YNAB normally. The MCP server leverages existing YNAB fields (memo, flag, payee, category, import_id) and never creates lock-in.
- **Local workspace integration** -- The MCP server has access to the user's local filesystem, enabling workflows where bank export files are dropped into a folder and processed conversationally

---

## Target Audience

### Primary User Persona

**Privacy-conscious YNAB power users who are technically proficient and already in the AI/LLM ecosystem.**

- Actively use YNAB but refuse to connect financial accounts through third-party aggregators (Plaid, MX)
- Currently import transactions manually via bank exports (CSV, OFX, QFX) or hand-enter them
- Technically savvy -- comfortable installing and configuring MCP servers, using Claude Desktop or similar AI tools
- Likely managing multiple accounts (checking, savings, credit cards) across several financial institutions
- Active on GitHub -- the type of user who discovers tools through repos, stars projects they find useful, and may contribute back
- Privacy is a core value, not a convenience trade-off -- they've made a deliberate choice to avoid data aggregators

### Audience Characteristics

- **Skill level:** Technical users comfortable with CLI tools, local server setup, and API tokens
- **Motivation:** Reduce the friction of manual YNAB management without sacrificing privacy
- **Discovery channel:** GitHub, Reddit r/ynab, HackerNews, MCP tool directories
- **Size:** Niche but passionate -- the intersection of YNAB power users and privacy-first technical users

---

## MVP Scope

### MVP (v1) -- Three Pillars

The MVP delivers a robust, immediately useful tool with three core capabilities:

**1. Transaction Import Pipeline**
- Parse exported files (CSV, OFX, QFX) from any financial institution
- Bulk-import transactions into YNAB with proper formatting
- Deduplication via YNAB's import_id mechanism
- Payee matching and normalization
- Handle the messy reality of varied bank export formats

**2. AI-Powered Categorization**
- Learn from the user's existing YNAB transaction history and category patterns
- Suggest or auto-assign categories for imported transactions
- Support for split transaction categorization
- User confirmation/override flow -- AI suggests, user approves

**3. Full YNAB API as MCP Tools**
- Every YNAB API endpoint exposed as an MCP tool
- Enables natural conversational interaction with budget data
- Users can query balances, review categories, check account status, and more through conversation
- Provides the foundation for users to build creative workflows beyond what we've imagined

### Deferred to v2+

The following capabilities are part of the long-term vision but explicitly out of MVP scope. Future prioritization will be driven by user interest and the author's enthusiasm:

- Receipt-to-transaction (photo scanning with automatic split categorization)
- Proactive budget insights and anomaly detection
- Subscription drift detection
- Predictive category burn rate analysis
- Cross-category spend correlation
- Budget reallocation recommendations

---

## Success Metrics

This is an open-source hobby project hosted on GitHub. Success is measured by community adoption and engagement:

| Metric | Signal |
|--------|--------|
| **GitHub Stars** | Interest and perceived value from the YNAB/MCP community |
| **Forks** | Users wanting to customize or contribute |
| **Downloads / Clones** | Active adoption and usage |
| **Issues & Discussions** | Community engagement and feature demand signals |
| **Pull Requests** | Community contribution and investment in the project |

Commercial metrics (revenue, paid users, conversion) are explicitly not goals. The project optimizes for **utility and delight** for the target audience.

---

## Assumptions & Risks

### Key Assumptions

- YNAB's public API remains stable, accessible, and free for personal access token usage
- The target user is comfortable installing and configuring an MCP server on their local machine
- Bank export formats (especially CSV) vary significantly across institutions, requiring flexible parsing rather than brittle format-specific logic
- AI categorization accuracy of ~80%+ with user review/override is a massive improvement over 100% manual categorization and will be perceived as valuable
- The MCP ecosystem continues to grow, expanding the pool of potential users who already have MCP-capable AI tools configured

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **YNAB API changes or deprecation** | High -- core dependency | Build abstraction layer; monitor YNAB developer communications |
| **YNAB API rate limits (200 req/hour)** | Medium -- constrains heavy conversational use | Cache aggressively; batch API calls; inform users of limits |
| **CSV format fragmentation across banks** | Medium -- parsing complexity | Start with common formats; community-contributed format configs (similar to bank2ynab approach) |
| **Scope creep on a passion project** | Medium -- delays MVP delivery | Strict MVP boundary defined above; "v2 = whatever feels fun next" keeps it pressure-free |
| **MCP protocol evolution** | Low -- protocol is maturing | Follow MCP spec updates; modular tool architecture makes adaptation straightforward |
