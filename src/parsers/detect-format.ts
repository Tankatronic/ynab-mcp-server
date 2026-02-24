import { readFile, access, constants } from "node:fs/promises";
import { extname } from "node:path";
import { ParseError } from "../utils/errors.js";
import type { FileFormat } from "./types.js";

/**
 * Auto-detect file format by extension and content inspection.
 */
export async function detectFormat(filePath: string): Promise<FileFormat> {
  await access(filePath, constants.R_OK).catch(() => {
    throw new ParseError(`File not found or not readable: ${filePath}`);
  });

  const ext = extname(filePath).toLowerCase();
  if (ext === ".ofx") return "ofx";
  if (ext === ".qfx") return "qfx";
  if (ext === ".csv") return "csv";

  // Inspect content for format hints
  const content = await readFile(filePath, "utf-8");
  const trimmed = content.trimStart();

  if (trimmed.startsWith("OFXHEADER") || trimmed.startsWith("<?OFX")) {
    return "ofx";
  }

  // Check for XML/SGML OFX markers
  if (trimmed.includes("<OFX>") || trimmed.includes("<OFX ")) {
    return trimmed.toLowerCase().includes("qfx") ? "qfx" : "ofx";
  }

  // Check if it looks like CSV (contains commas or tabs with consistent row structure)
  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length >= 2) {
    const firstLineCommas = (lines[0].match(/,/g) || []).length;
    if (firstLineCommas >= 2) {
      return "csv";
    }
  }

  return "unknown";
}

export async function readFileContent(filePath: string): Promise<string> {
  await access(filePath, constants.R_OK).catch(() => {
    throw new ParseError(`File not found or not readable: ${filePath}`);
  });
  return readFile(filePath, "utf-8");
}
