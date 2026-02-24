/**
 * Dual-format response builder: human-readable markdown + structured JSON.
 */

export interface ToolSuccessResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
}

export function formatToolResponse(
  markdown: string,
  data: unknown,
): ToolSuccessResponse {
  const text = `${markdown}\n\n---\n_Raw data:_\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
  return {
    content: [{ type: "text", text }],
  };
}
