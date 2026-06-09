import { createHash } from "crypto";

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Clean a raw bank-statement markdown string by stripping boilerplate,
 * normalising formats, and detecting the transaction table.
 *
 * @param raw - Raw markdown (zero-loss) from the parser.
 * @returns Cleaned markdown with a unified table and standardised cells.
 */
export function cleanStatement(raw: string): string {
  if (!raw.trim()) return "";

  let text = raw;

  /* 1. Strip line-noise patterns */
  text = stripBoilerplate(text);

  /* 2. Split into lines and remove empty leading/trailing runs */
  const lines = text.split("\n").map((l) => l.trimEnd());
  const nonEmpty = lines.filter((l) => l.trim().length > 0);

  /* 3. Detect the table region — find the header row and the last data row */
  const headerIdx = findTableHeader(nonEmpty);
  if (headerIdx === -1) {
    /* No recognisable table; return the raw text as-is */
    return raw.trim();
  }

  /* 4. Extract header and data rows */
  const headerLine = nonEmpty[headerIdx];
  const dataLines = extractDataLines(nonEmpty, headerIdx);

  /* 5. Normalise the header */
  const normalisedHeader = normaliseHeader(headerLine);

  /* 6. Detect column positions from the normalised header */
  const columns = detectColumns(normalisedHeader);

  /* 7. Parse and normalise each data row */
  const cleanedRows: string[] = [normalisedHeader];
  const balCol = columns.findIndex((c) => c === "balance");

  for (const line of dataLines) {
    const normalised = normaliseDataRow(line, columns);
    if (normalised) {
      cleanedRows.push(normalised);
    }
  }

  /* 8. Add a markdown separator row under the header if not present */
  if (cleanedRows.length > 1) {
    const colCount = cleanedRows[0].split("|").length - 2; // minus leading/trailing empty
    const sep =
      "|" +
      Array.from({ length: colCount }, () => " --- ").join("|") +
      "|";
    cleanedRows.splice(1, 0, sep);
  }

  return cleanedRows.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Boilerplate removal                                                */
/* ------------------------------------------------------------------ */

const BOILERPLATE_PATTERNS: RegExp[] = [
  /* Page numbers — "Page X of Y", "Page X", "P. X" */
  /\b(?:page|p\.?)\s*\d+\s*(?:of|\/)\s*\d+/gi,
  /\bpage\s+\d+\s*$/gim,
  /^page\s+\d+\s*$/gim,

  /* Bank / branch address blocks */
  /^\d{1,5}\s+[A-Z][A-Za-z\s,]+(?:Street|Road|Avenue|Lane|Drive|Way|Boulevard|Plaza|Court|Circle|Parkway|St|Rd|Ave|Ln|Dr|Blvd|Pkwy|Hwy)\s*\n?/gm,
  /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$/gm,

  /* Terms & conditions footers */
  /^(?:terms?\s*(?:and|&)\s*(?:conditions?|cond\.?)|see\s+(?:reverse|over|back|below)|continued\s*(?:on\s*)?(?:next\s*)?page|thank\s+you|(?:please\s+)?keep\s+this\s+(?:statement|record|notice))/gim,

  /* Contact / support info */
  /^(?:customer\s+service|(?:call|contact)\s+(?:us\s+at|(?:toll\s+)?free)|email\s+|visit\s+(?:us\s+at|our\s+website)|online\s+(?:banking|support)|branch\s+(?:locator|finder)|enquiries?\s*(?:and|&)\s*(?:complaints?|support))\b.*$/gim,

  /* Disclaimers */
  /^(?:disclaimer|important\s+notice|please\s+note|this\s+statement|errors?\s+(?:and\s+)?omissions?\s*(?:and\s+)?exceptions?\s*)/gim,
  /^\*.*(?:terms?\s+and\s+conditions?|fees?\s+and\s+charges?|interest\s+(?:rate|calculation)|minimum\s+(?:payment|amount|balance)|annual\s+(?:fee|percentage|rate|charge))/gim,
  /^\*.*\n*/gm,

  /* "Continued on next page" */
  /continued\s*(?:\.\.\.|…)?\s*(?:on\s+)?(?:the\s+)?(?:next|following)\s+page/gi,

  /* Opening bonus/header graphics text artifacts */
  /^(?:opening\s+balance|closing\s+balance|total\s+(?:debits?|credits?|deposits?|withdrawals?))\s*:?\s*[-$€£\d,.\s]+\s*$/gim,
];

function stripBoilerplate(text: string): string {
  let result = text;
  for (const pattern of BOILERPLATE_PATTERNS) {
    result = result.replace(pattern, "");
  }

  /* Remove lines that consist solely of special characters (borders, etc.) */
  result = result.replace(/^[=\-*_~#]{3,}\s*$/gm, "");

  /* Collapse multiple consecutive blank lines into one */
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/* ------------------------------------------------------------------ */
/*  Table detection                                                    */
/* ------------------------------------------------------------------ */

function findTableHeader(lines: string[]): number {
  const headerKeywords = [
    /\bdate\b/i,
    /\bdescription\b/i,
    /\bdetails\b/i,
    /\bparticulars\b/i,
    /\bdebit\b/i,
    /\bcredit\b/i,
    /\bwithdrawal\b/i,
    /\bdeposit\b/i,
    /\bbalance\b/i,
    /\bamount\b/i,
    /\btransaction\b/i,
  ];

  for (let i = 0; i < Math.min(50, lines.length); i++) {
    const line = lines[i].toLowerCase();
    let score = 0;
    for (const kw of headerKeywords) {
      if (kw.test(line)) score++;
    }
    if (score >= 3) return i;
  }

  /* Second pass: look for pipes (markdown table) */
  for (let i = 0; i < Math.min(50, lines.length); i++) {
    if (lines[i].startsWith("|") && lines[i].includes("|")) {
      const row = lines[i].toLowerCase();
      let score = 0;
      for (const kw of headerKeywords) {
        if (kw.test(row)) score++;
      }
      if (score >= 2) return i;
    }
  }

  return -1;
}

function extractDataLines(
  lines: string[],
  headerIdx: number,
): string[] {
  const dataLines: string[] = [];

  /* Skip the header separator row if present (e.g. | --- | --- |) */
  let start = headerIdx + 1;
  if (
    start < lines.length &&
    /^\|\s*[-:]+\s\|/.test(lines[start])
  ) {
    start++;
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    /* Stop at summary/subtotal/total lines */
    if (
      /^(total|sub-?total|closing\s+balance|ending\s+balance)/i.test(line)
    ) {
      break;
    }

    dataLines.push(line);
  }

  return dataLines;
}

/* ------------------------------------------------------------------ */
/*  Header normalisation                                               */
/* ------------------------------------------------------------------ */

const HEADER_MAP: Record<string, string> = {
  /* Date variants */
  date: "Date",
  "tran date": "Date",
  "trans date": "Date",
  "transaction date": "Date",
  "posting date": "Date",
  "value date": "Date",
  "eff date": "Date",
  "effective date": "Date",
  "post date": "Date",

  /* Description variants */
  description: "Description",
  details: "Description",
  particulars: "Description",
  narrative: "Description",
  transaction: "Description",
  merchant: "Description",
  payee: "Description",
  reference: "Description",
  memo: "Description",
  "transaction details": "Description",

  /* Debit variants */
  debit: "Debit",
  debits: "Debit",
  withdrawals: "Debit",
  withdrawal: "Debit",
  "paid out": "Debit",
  charge: "Debit",
  charges: "Debit",
  dr: "Debit",
  withdraw: "Debit",
  withdrawn: "Debit",
  payment: "Debit",
  payments: "Debit",

  /* Credit variants */
  credit: "Credit",
  credits: "Credit",
  deposits: "Credit",
  deposit: "Credit",
  "paid in": "Credit",
  cr: "Credit",
  interest: "Credit",

  /* Balance variants */
  balance: "Balance",
  "running balance": "Balance",
  outstanding: "Balance",
  "ledger balance": "Balance",
  "available balance": "Balance",
  "closing balance": "Balance",
  "opening balance": "Balance",

  /* Amount (used when debit/credit not split) */
  amount: "Amount",
  value: "Amount",
  sum: "Amount",
  total: "Amount",
};

function normaliseHeader(line: string): string {
  /* Handle markdown table format */
  if (line.startsWith("|")) {
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    const normalised = cells.map((cell) => normaliseHeaderCell(cell));
    return "| " + normalised.join(" | ") + " |";
  }

  /* Handle space/tab delimited */
  const tokens = line
    .split(/\s{2,}|\t+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length >= 3) {
    const normalised = tokens.map((t) => normaliseHeaderCell(t));
    return "| " + normalised.join(" | ") + " |";
  }

  return line;
}

function normaliseHeaderCell(cell: string): string {
  const cleaned = cell.replace(/[^a-zA-Z\s/]/g, "").trim().toLowerCase();
  if (!cleaned) return cell.trim();

  /* Try longest match first */
  const keys = Object.keys(HEADER_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (cleaned === key || cleaned.startsWith(key)) {
      return HEADER_MAP[key];
    }
  }

  /* Partial match fallback */
  for (const key of keys) {
    if (cleaned.includes(key) || key.includes(cleaned)) {
      return HEADER_MAP[key];
    }
  }

  return cell.trim();
}

/* ------------------------------------------------------------------ */
/*  Column detection (for data-row normalisation)                      */
/* ------------------------------------------------------------------ */

type ColumnRole = "date" | "description" | "debit" | "credit" | "balance" | "amount" | "unknown";

function detectColumns(headerLine: string): ColumnRole[] {
  const cells = headerLine
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);

  return cells.map((cell) => {
    const lower = cell.toLowerCase();
    if (/^date$/i.test(lower)) return "date";
    if (/^description$/i.test(lower)) return "description";
    if (/^debit$/i.test(lower)) return "debit";
    if (/^credit$/i.test(lower)) return "credit";
    if (/^balance$/i.test(lower)) return "balance";
    if (/^amount$/i.test(lower)) return "amount";
    return "unknown";
  });
}

/* ------------------------------------------------------------------ */
/*  Data row normalisation                                             */
/* ------------------------------------------------------------------ */

function normaliseDataRow(
  line: string,
  columns: ColumnRole[],
): string | null {
  /* Parse cells */
  let cells: string[];

  if (line.startsWith("|")) {
    cells = line
      .split("|")
      .map((c) => c.trim());
    /* Remove leading/trailing empty from pipe splits */
    if (cells.length > 0 && cells[0] === "") cells.shift();
    if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  } else {
    /* Try splitting by 2+ spaces (PDF text extraction style) */
    const parts = line.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= columns.length) {
      cells = parts;
    } else {
      /* Fallback: single-space split, try to realign */
      cells = parts;
    }
  }

  /* If we have more cells than columns, try to re-align (common when
     description contains dates or amounts as text) */
  if (cells.length > columns.length && columns.length >= 3) {
    cells = realignCells(cells, columns);
  }

  /* If we have fewer cells than columns, pad with empty strings */
  while (cells.length < columns.length) {
    cells.push("");
  }

  /* Normalise each cell according to its role */
  const normalised: string[] = [];
  for (let i = 0; i < columns.length && i < cells.length; i++) {
    const raw = cells[i].trim();
    const role = columns[i];
    normalised.push(normaliseCell(raw, role));
  }

  /* Skip empty / non-transaction rows */
  const dateCell = normalised[columns.indexOf("date")] ?? "";
  if (!dateCell || dateCell === "-" || dateCell === "") {
    /* Allow rows that have amounts but no date (e.g. continuation rows) */
    const hasAmounts = normalised.some(
      (c, i) =>
        (columns[i] === "debit" || columns[i] === "credit" || columns[i] === "balance") &&
        c !== "",
    );
    if (!hasAmounts) return null;
  }

  return "| " + normalised.join(" | ") + " |";
}

/**
 * When the description cell contains spaces, the parser might split it into
 * multiple cells. This function attempts to fold extra cells back into the
 * description column.
 */
function realignCells(
  cells: string[],
  columns: ColumnRole[],
): string[] {
  /* Strategy: keep date at position 0, fold everything between date and
     the first numeric column into description. */
  const dateIdx = columns.indexOf("date");
  const debitIdx = columns.indexOf("debit");
  const creditIdx = columns.indexOf("credit");
  const balIdx = columns.indexOf("balance");

  const firstNumericIdx = [debitIdx, creditIdx, balIdx]
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];

  if (dateIdx < 0 || firstNumericIdx <= dateIdx + 1) {
    /* Can't realign meaningfully; return as-is */
    return cells.slice(0, columns.length);
  }

  const result: string[] = [];
  for (let c = 0; c < columns.length; c++) {
    if (c === dateIdx && c < cells.length) {
      result.push(cells[c]);
    } else if (c === dateIdx + 1 && firstNumericIdx > dateIdx + 1) {
      /* Description spans from this column to right before first numeric */
      const descParts = cells.slice(c, firstNumericIdx);
      result.push(descParts.join(" "));
      /* Skip the consumed cells */
      c = firstNumericIdx - 1;
    } else {
      const cellIdx = mapToCellIndex(c, dateIdx, firstNumericIdx, cells.length, columns.length);
      if (cellIdx < cells.length) {
        result.push(cells[cellIdx]);
      } else {
        result.push("");
      }
    }
  }

  return result;
}

function mapToCellIndex(
  colIdx: number,
  dateIdx: number,
  firstNumeric: number,
  cellCount: number,
  colCount: number,
): number {
  /* After the description region, cells shift left */
  const descSpan = firstNumeric - dateIdx - 1;
  const extraCells = cellCount - colCount;

  if (colIdx <= dateIdx) return colIdx;
  if (colIdx < firstNumeric) {
    /* Description column absorbs extra cells */
    return dateIdx + 1;
  }
  /* Numeric columns — shift right by the number of extra cells */
  return colIdx + extraCells;
}

/* ------------------------------------------------------------------ */
/*  Cell value normalisation                                           */
/* ------------------------------------------------------------------ */

function normaliseCell(raw: string, role: ColumnRole): string {
  const trimmed = raw.trim();

  switch (role) {
    case "date": {
      const normalised = normaliseDateCell(trimmed);
      return normalised || trimmed;
    }

    case "debit":
    case "credit":
    case "balance":
    case "amount": {
      const num = parseAmountCell(trimmed);
      if (num !== null) {
        /* Format with 2 decimal places, no thousands separator */
        return role === "debit" || role === "credit"
          ? num.toFixed(2)
          : num.toFixed(2);
      }
      return trimmed;
    }

    case "description":
      /* Collapse internal whitespace, strip leading/trailing noise */
      return trimmed.replace(/\s+/g, " ").replace(/^[-•*]\s*/, "");

    default:
      return trimmed.replace(/\s+/g, " ");
  }
}

const DATE_PATTERNS: Array<{
  re: RegExp;
  fn: (m: RegExpMatchArray) => string;
}> = [
  // YYYY-MM-DD
  {
    re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    fn: (m) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
  },
  // DD/MM/YYYY or DD-MM-YYYY
  {
    re: /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/,
    fn: (m) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
  },
  // DD/MM/YY
  {
    re: /^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/,
    fn: (m) => {
      const yy = +m[3] < 50 ? `20${m[3]}` : `19${m[3]}`;
      return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    },
  },
  // DD-Mon-YYYY or DD-Mon-YY
  {
    re: /^(\d{1,2})[-/](\w{3,})[-/](\d{2,4})$/,
    fn: (m) => {
      const months: Record<string, string> = {
        jan: "01", january: "01",
        feb: "02", february: "02",
        mar: "03", march: "03",
        apr: "04", april: "04",
        may: "05",
        jun: "06", june: "06",
        jul: "07", july: "07",
        aug: "08", august: "08",
        sep: "09", sept: "09", september: "09",
        oct: "10", october: "10",
        nov: "11", november: "11",
        dec: "12", december: "12",
      };
      const mon = months[m[2].toLowerCase().slice(0, 3)];
      if (!mon) return "";
      const yy = m[3].length === 2
        ? (+m[3] < 50 ? `20${m[3]}` : `19${m[3]}`)
        : m[3];
      return `${yy}-${mon}-${m[1].padStart(2, "0")}`;
    },
  },
  // Mon DD, YYYY (e.g. "Jan 1, 2024" or "January 1, 2024")
  {
    re: /^(\w{3,})\s+(\d{1,2}),?\s+(\d{4})$/,
    fn: (m) => {
      const months: Record<string, string> = {
        jan: "01", january: "01",
        feb: "02", february: "02",
        mar: "03", march: "03",
        apr: "04", april: "04",
        may: "05",
        jun: "06", june: "06",
        jul: "07", july: "07",
        aug: "08", august: "08",
        sep: "09", sept: "09", september: "09",
        oct: "10", october: "10",
        nov: "11", november: "11",
        dec: "12", december: "12",
      };
      const mon = months[m[1].toLowerCase().slice(0, 3)];
      if (!mon) return "";
      return `${m[3]}-${mon}-${m[2].padStart(2, "0")}`;
    },
  },
];

function normaliseDateCell(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return "";

  for (const { re, fn } of DATE_PATTERNS) {
    const m = cleaned.match(re);
    if (m) {
      const result = fn(m);
      if (result) return result;
    }
  }
  return "";
}

function parseAmountCell(raw: string): number | null {
  if (!raw) return null;

  let negative = false;
  let cleaned = raw.trim();

  /* Handle parentheses for negatives: (1,234.56) -> -1234.56 */
  if (/^\(.*\)$/.test(cleaned)) {
    negative = true;
    cleaned = cleaned.slice(1, -1);
  }

  /* Remove currency symbols */
  cleaned = cleaned.replace(/^[£$€¥₩₹₽₱₿₪₫₦₵﷼₡₸₺₼₾\s]+/, "");
  cleaned = cleaned.replace(/[£$€¥₩₹₽₱₿₪₫₦₵﷼₡₸₺₼₾\s]+$/, "");

  /* Handle leading minus */
  if (cleaned.startsWith("-")) {
    negative = true;
    cleaned = cleaned.slice(1);
  }

  /* Handle trailing minus (some European formats) */
  if (cleaned.endsWith("-")) {
    negative = true;
    cleaned = cleaned.slice(0, -1);
  }

  /* CR / DR suffixes */
  if (/cr$/i.test(cleaned)) {
    cleaned = cleaned.replace(/cr$/i, "");
  }
  if (/dr$/i.test(cleaned)) {
    negative = true;
    cleaned = cleaned.replace(/dr$/i, "");
  }

  /* Remove commas */
  const numeric = cleaned.replace(/,/g, "").trim();
  const val = parseFloat(numeric);
  if (isNaN(val)) return null;

  return negative ? -val : val;
}
