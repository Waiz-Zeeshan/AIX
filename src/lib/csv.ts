/**
 * Minimal RFC 4180-style CSV parser for the user-import path (SRS §6.1 FR-A1,
 * §17 sample format). Handles:
 *   - UTF-8 BOM at start of file
 *   - LF, CRLF, and lone CR line endings
 *   - Quoted fields containing commas, newlines, and escaped double-quotes ("")
 *   - Trailing newline at EOF (no empty record emitted)
 *   - Blank lines (skipped)
 *
 * Returns rows as `string[]`. The caller decides what the header row means.
 * Throws `CsvParseError` with a 1-based row number if the input is malformed
 * (e.g. an unterminated quoted field).
 */

export class CsvParseError extends Error {
  readonly row: number;
  constructor(message: string, row: number) {
    super(message);
    this.name = "CsvParseError";
    this.row = row;
  }
}

export function parseCsv(input: string): string[][] {
  // Strip UTF-8 BOM if present.
  let src = input;
  if (src.charCodeAt(0) === 0xfeff) {
    src = src.slice(1);
  }

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let lineNumber = 1;
  let rowStartLine = 1;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    // Skip rows that are entirely empty (e.g. trailing newline at EOF, or blank lines).
    if (row.length === 1 && row[0] === "") {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          // Escaped quote inside quoted field.
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") lineNumber++;
        field += ch;
      }
      continue;
    }

    // Not in quotes.
    if (ch === '"') {
      // Only treat as opening quote if field is empty so far; otherwise treat
      // as literal. This is lenient but matches Excel/Sheets exports.
      if (field.length === 0) {
        inQuotes = true;
        rowStartLine = lineNumber;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === ",") {
      pushField();
      continue;
    }

    if (ch === "\r") {
      // Treat \r and \r\n the same: end of row. Skip a following \n.
      pushField();
      pushRow();
      if (src[i + 1] === "\n") i++;
      lineNumber++;
      continue;
    }

    if (ch === "\n") {
      pushField();
      pushRow();
      lineNumber++;
      continue;
    }

    field += ch;
  }

  if (inQuotes) {
    throw new CsvParseError(
      "Unterminated quoted field",
      rowStartLine
    );
  }

  // Flush final field/row if input did not end with newline.
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }

  return rows;
}
