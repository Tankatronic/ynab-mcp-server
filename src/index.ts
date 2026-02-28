#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initYnabClient } from "./ynab/client.js";
import { logger } from "./utils/logger.js";

// Tool registrations
import { registerGetBudgetOverview } from "./tools/get-budget-overview.js";
import { registerSearchTransactions } from "./tools/search-transactions.js";
import { registerGetSpendingByCategory } from "./tools/get-spending-by-category.js";
import { registerGetMonthlyTrends } from "./tools/get-monthly-trends.js";
import { registerCreateTransaction } from "./tools/create-transaction.js";
import { registerUpdateTransaction } from "./tools/update-transaction.js";
import { registerUpdateCategoryBudget } from "./tools/update-category-budget.js";
import { registerParseBankExport } from "./tools/parse-bank-export.js";
import { registerPreviewImport } from "./tools/preview-import.js";
import { registerImportTransactions } from "./tools/import-transactions.js";
import { registerReconcileImport } from "./tools/reconcile-import.js";
import { registerListWorkflowConfigs } from "./tools/list-workflow-configs.js";
import { registerReadWorkflowConfig } from "./tools/read-workflow-config.js";

logger.info("server", "ynab-mcp-server v1.0.0 starting");

const server = new McpServer({
  name: "ynab-mcp-server",
  version: "1.0.0",
});

// Initialize YNAB client (reads YNAB_API_TOKEN from env)
try {
  initYnabClient();
  logger.info("server", "YNAB client initialized successfully");
} catch (error) {
  // Token may not be set yet -- tools will fail with a clear error
  // This allows the server to start and report the missing token issue
  // when a tool is actually called
  logger.warn("server", "YNAB client init deferred — token not set", error);
}

// Register all tools
registerGetBudgetOverview(server);
registerSearchTransactions(server);
registerGetSpendingByCategory(server);
registerGetMonthlyTrends(server);
registerCreateTransaction(server);
registerUpdateTransaction(server);
registerUpdateCategoryBudget(server);
registerParseBankExport(server);
registerPreviewImport(server);
registerImportTransactions(server);
registerReconcileImport(server);
registerListWorkflowConfigs(server);
registerReadWorkflowConfig(server);
logger.info("server", "All 13 tools registered");

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
logger.info("server", "Connected via stdio transport — ready for requests");
