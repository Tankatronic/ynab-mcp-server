/**
 * Date format detection and normalization for bank exports.
 * All dates are normalized to YYYY-MM-DD (YNAB's format).
 */

const DATE_PATTERNS: Array<{
  regex: RegExp;
  parse: (match: RegExpMatchArray) => string;
}> = [
  // YYYY-MM-DD (ISO)
  {
    regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    parse: (m) =>
      `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
  },
  // MM/DD/YYYY
  {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parse: (m) =>
      `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`,
  },
  // MM-DD-YYYY
  {
    regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    parse: (m) =>
      `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`,
  },
  // DD/MM/YYYY (hint required to disambiguate from MM/DD/YYYY)
  // Handled via the dateFormatHint parameter
  // MM/DD/YY
  {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    parse: (m) => {
      const year = parseInt(m[3], 10);
      const fullYear = year >= 70 ? 1900 + year : 2000 + year;
      return `${fullYear}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    },
  },
  // YYYYMMDD (compact)
  {
    regex: /^(\d{4})(\d{2})(\d{2})$/,
    parse: (m) => `${m[1]}-${m[2]}-${m[3]}`,
  },
];

export type DateFormatHint = "MM/DD/YYYY" | "DD/MM/YYYY" | "auto";

export function parseDate(
  dateStr: string,
  hint: DateFormatHint = "auto",
): string | null {
  const trimmed = dateStr.trim();

  // Handle DD/MM/YYYY hint
  if (hint === "DD/MM/YYYY") {
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }
  }

  for (const pattern of DATE_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      return pattern.parse(match);
    }
  }

  return null;
}

export function isValidDate(yyyymmdd: string): boolean {
  const match = yyyymmdd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
