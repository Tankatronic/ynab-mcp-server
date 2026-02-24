import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatError } from "../utils/errors.js";

const BUNDLED_DIR = resolve(
  fileURLToPath(import.meta.url),
  "../../workflows",
);

async function findConfig(
  name: string,
  customDir?: string,
): Promise<string | null> {
  const extensions = [".md", ".yaml", ".yml"];

  // Check bundled first
  for (const ext of extensions) {
    try {
      const path = join(BUNDLED_DIR, `${name}${ext}`);
      return await readFile(path, "utf-8");
    } catch {
      // Not found, try next
    }
  }

  // Check custom directory
  const customPath = customDir ?? process.env.YNAB_MCP_WORKFLOWS_DIR;
  if (customPath) {
    for (const ext of extensions) {
      try {
        const path = join(customPath, `${name}${ext}`);
        return await readFile(path, "utf-8");
      } catch {
        // Not found, try next
      }
    }
  }

  return null;
}

export function registerReadWorkflowConfig(server: McpServer): void {
  server.tool(
    "read_workflow_config",
    "Read the contents of a workflow configuration file. The LLM should follow these step-by-step instructions.",
    {
      name: z
        .string()
        .describe(
          'Workflow config name (without extension), e.g. "import-categorize"',
        ),
      custom_dir: z
        .string()
        .optional()
        .describe("Custom workflow directory path. Also checks YNAB_MCP_WORKFLOWS_DIR env var."),
    },
    async ({ name, custom_dir }) => {
      try {
        const content = await findConfig(name, custom_dir);

        if (!content) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: "NOT_FOUND",
                  message: `Workflow config "${name}" not found. Use list_workflow_configs to see available configs.`,
                  retryable: false,
                }),
              },
            ],
          } as const;
        }

        return {
          content: [{ type: "text" as const, text: content }],
        } as const;
      } catch (error) {
        return formatError(error);
      }
    },
  );
}
