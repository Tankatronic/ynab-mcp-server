import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatError } from "../utils/errors.js";
import { formatToolResponse } from "../utils/response-formatter.js";
import { logger } from "../utils/logger.js";

const BUNDLED_DIR = resolve(
  fileURLToPath(import.meta.url),
  "../../workflows",
);

export function registerListWorkflowConfigs(server: McpServer): void {
  server.tool(
    "list_workflow_configs",
    "List available workflow configuration files (bundled and custom). Workflow configs guide the LLM through multi-step processes like import and reconciliation.",
    {
      custom_dir: z
        .string()
        .optional()
        .describe(
          "Path to a directory containing custom workflow configs. Also checks YNAB_MCP_WORKFLOWS_DIR env var.",
        ),
    },
    async ({ custom_dir }) => {
      logger.info("tool", "list_workflow_configs invoked", { custom_dir });
      try {
        const configs: Array<{
          name: string;
          source: "bundled" | "custom";
          path: string;
        }> = [];

        // Read bundled configs
        try {
          const files = await readdir(BUNDLED_DIR);
          for (const file of files) {
            if (file.endsWith(".md") || file.endsWith(".yaml") || file.endsWith(".yml")) {
              configs.push({
                name: file.replace(/\.(md|yaml|yml)$/, ""),
                source: "bundled",
                path: join(BUNDLED_DIR, file),
              });
            }
          }
        } catch {
          // Bundled dir may not exist in dev
        }

        // Read custom configs
        const customPath =
          custom_dir ?? process.env.YNAB_MCP_WORKFLOWS_DIR;
        if (customPath) {
          try {
            const files = await readdir(customPath);
            for (const file of files) {
              if (file.endsWith(".md") || file.endsWith(".yaml") || file.endsWith(".yml")) {
                configs.push({
                  name: file.replace(/\.(md|yaml|yml)$/, ""),
                  source: "custom",
                  path: join(customPath, file),
                });
              }
            }
          } catch {
            // Custom dir may not exist
          }
        }

        let md = `## Available Workflow Configs\n\n`;
        if (configs.length === 0) {
          md += `_No workflow configs found._\n`;
        } else {
          md += `| Name | Source |\n`;
          md += `|------|--------|\n`;
          for (const c of configs) {
            md += `| ${c.name} | ${c.source} |\n`;
          }
        }

        logger.info("tool", "list_workflow_configs completed", { configCount: configs.length });
        return formatToolResponse(md, { configs });
      } catch (error) {
        logger.error("tool", "list_workflow_configs failed", error);
        return formatError(error);
      }
    },
  );
}
