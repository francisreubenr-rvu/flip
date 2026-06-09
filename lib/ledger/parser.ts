import * as XLSX from "xlsx";
import { extractText } from "unpdf";
import { readFile } from "fs/promises";
import { createHash } from "crypto";
import type {
  StatementParseResult,
  Statement,
  Transaction,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export async function parseFile(
  filePath: string,
): Promise<StatementParseResult> {
  const ext = detectExtension(filePath);

  if (ext === "xlsx") {
    return parseXLSX(filePath);
  }
  return parsePDF(filePath);
}

/* ------------------------------------------------------------------ */
/*  Extension detection                                                */
/* ------------------------------------------------------------------ */

function detectExtension(filePath: string): "xlsx" | "pdf" {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) {
    throw new Error(
      `Cannot detect file type — no extension found in path: ${filePath}`,
    );
  }
  const ext = filePath.slice(dot + 1).toLowerCase();
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "pdf") return "pdf";
  throw new Error(
    `Unsupported file extension ".${ext}". Accepted: .xlsx, .xls, .pdf`,
  );
}

/* ------------------------------------------------------------------ */
/*  Fingerprint                                                        */
/* ------------------------------------------------------------------ */

function fingerprint(
  date: string,
  description: string,
  debit: number | null,
  credit: number | null,
  balance: number,
): string {
  const normalized = [
    date,
    description,
    debit ?? "",
    credit ?? "",
    balance,
  ].join("|");
  return createHash("sha256").update(normalized, "utf-8").digest("hex");
}

/* ------------------------------------------------------------------ */
/*  XLSX Parser                                                        */
/* ------------------------------------------------------------------ */

async function parseXLSX(filePath: string): Promise<StatementParseResult> {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("XLSX workbook has no sheets");

  const sheet = workbook.Sheets[sheetName];
  const ref = sheet["!ref"];
  if (!ref) throw new Error("Sheet has no data range");

  const range = XLSX.utils.decode_range(ref);
  const numRows = range.e.r - range.s.r + 1;
  const numCols = range.e.c - range.s.c + 1;

  /* Build merged-cell lookup — every cell in the merged area gets the
     value of the top-left (master) cell. */
  const mergedValues = buildMergedCellMap(sheet);

  /* Build a dense string matrix of every cell in the sheet. */
  const matrix: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = XLSX.utils.encode_cell({ r, c });
      if (mergedValues.has(key)) {
        row.push(mergedValues.get(key)!);
      } else {
        const cell = sheet[key];
        row.push(cell?.v !== undefined && cell?.v !== null ? String(cell.v) : "");
      }
    }
    matrix.push(row);
  }

  /* Build the zero-loss raw markdown table. */
  const rawMarkdown = matrixToMarkdown(matrix);

  /* Parse structured data from the matrix. */
  const statement = extractStatementFromMatrix(matrix);

  return {
    statement,
    rawMarkdown,
    cleanedMarkdown: rawMarkdown,
  };
}

function buildMergedCellMap(
  sheet: XLSX.WorkSheet,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!sheet["!merges"]) return map;

  for (const merge of sheet["!merges"]) {
    const masterKey = XLSX.utils.encode_cell({
      r: merge.s.r,
      c: merge.s.c,
    });
    const masterCell = sheet[masterKey];
    const masterValue = masterCell?.v !== undefined && masterCell?.v !== null
      ? String(masterCell.v)
      : "";

    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        const key = XLSX.utils.encode_cell({ r, c });
        /* Only set if not already set, so earlier merges take priority */
        if (!map.has(key)) {
          map.set(key, masterValue);
        }
      }
    }
  }
  return map;
}

function matrixToMarkdown(matrix: string[][]): string {
  if (matrix.length === 0) return "";
  const maxCols = Math.max(...matrix.map((r) => r.length));
  return matrix
    .map((row) => {
      while (row.length < maxCols) row.push("");
      return `| ${row.map(escMd).join(" | ")} |`;
    })
    .join("\n");
}

function escMd(v: string): string {
  return v.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/* ---------- Parse structured data from the matrix ---------- */

interface MatrixMetadata {
  accountName: string;
  accountNumber: string;
  statementPeriod: { from: string; to: string };
  openingBalance: number;
  closingBalance: number;
}

function extractStatementFromMatrix(
  matrix: string[][],
): Statement {
  const metadata: MatrixMetadata = {
    accountName: "",
    accountNumber: "",
    statementPeriod: { from: "", to: "" },
    openingBalance: 0,
    closingBalance: 0,
  };

  /* Scan for metadata rows (rows where all columns contain text, no dates) */
  for (const row of matrix) {
    const joined = row.join(" ").toLowerCase();
    if (!metadata.accountName) {
      const m = joined.match(/account(?: name)?[:\s]+(.+)/i);
      if (m) metadata.accountName = m[1].trim();
    }
    if (!metadata.accountNumber) {
      const m = joined.match(
        /(?:account|acct)\s*(?:#|no|number|\.)[:\s]+(\S+)/i,
      );
      if (m) metadata.accountNumber = m[1].trim();
    }
    if (
      !metadata.statementPeriod.from &&
      !metadata.statementPeriod.to
    ) {
      const m = joined.match(
        /(?:period|statement|from|for)\s+(?:period\s+)?(?:from\s+)?(\S[-\/\w]+)\s+(?:to|through|thru|-\s*)\s+(\S[-\/\w]+)/i,
      );
      if (m) {
        metadata.statementPeriod.from = normalizeDate(m[1]);
        metadata.statementPeriod.to = normalizeDate(m[2]);
      }
    }
    if (!metadata.accountName) {
      const m = row[0]?.trim();
      if (m && m.length > 3 && !/\d/.test(m) && !/^(date|transaction|description|details|amount|debit|credit|balance|withdrawal|deposit)/i.test(m)) {
        // Potential account name in first column of a header-like row
        if (row.slice(1).every((c) => !c.trim() || /(?:statement|period|account|page)/i.test(c.trim()))) {
          metadata.accountName = m;
        }
      }
    }
  }

  /* Detect header row and transaction rows */
  const headerRowIndex = findHeaderRow(matrix);
  const transactions: Transaction[] = [];
  let closingBalance = 0;

  if (headerRowIndex !== -1) {
    const headerRow = matrix[headerRowIndex];
    const colIndices = detectColumnIndices(headerRow);

    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      const tx = rowToTransaction(row, colIndices);
      if (tx) {
        transactions.push(tx);
        closingBalance = tx.balance;
      }
    }
  }

  /* If no transactions found from header matching, fallback: scan every row
     for date-like content in first column and numeric content. */
  if (transactions.length === 0) {
    const fallback = fallbackParseTransactions(matrix);
    transactions.push(...fallback.transactions);
    closingBalance = fallback.closingBalance;

    if (!metadata.statementPeriod.from && fallback.transactions.length > 0) {
      metadata.statementPeriod = {
        from: fallback.transactions[0].date,
        to: fallback.transactions[fallback.transactions.length - 1].date,
      };
    }
    if (fallback.openingBalance !== 0) {
      metadata.openingBalance = fallback.openingBalance;
    }
  }

  /* Set opening balance — try first transaction's prior balance or use the
     first transaction balance and assume opening = first known balance. */
  if (metadata.openingBalance === 0 && transactions.length > 0) {
    metadata.openingBalance = transactions[0].balance;
  }

  return {
    accountName: metadata.accountName || "Unknown Account",
    accountNumber: metadata.accountNumber || "",
    statementPeriod: metadata.statementPeriod.from
      ? metadata.statementPeriod
      : { from: "", to: "" },
    openingBalance: metadata.openingBalance,
    closingBalance,
    transactions,
  };
}

function findHeaderRow(matrix: string[][]): number {
  for (let r = 0; r < Math.min(20, matrix.length); r++) {
    const joined = matrix[r].join(" ").toLowerCase();
    const hasDate =
      /\b(date|transaction\s*date|posting\s*date|value\s*date|tran\s*date)\b/.test(
        joined,
      );
    const hasDesc =
      /\b(description|details|particulars|narrative|transaction|merchant|payee)\b/
        .test(joined);
    const hasAmount =
      /\b(amount|debit|credit|withdrawal|deposit|paid\s*(in|out)|charge|payment|balance)\b/
        .test(joined);

    if (hasDate && hasDesc && hasAmount) return r;
  }
  return -1;
}

interface ColumnIndices {
  date: number;
  description: number;
  debit: number;
  credit: number;
  balance: number;
}

function detectColumnIndices(headerRow: string[]): ColumnIndices {
  const indices: ColumnIndices = {
    date: -1,
    description: -1,
    debit: -1,
    credit: -1,
    balance: -1,
  };

  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c].toLowerCase().trim();

    if (
      indices.date === -1 &&
      /\b(date|tran\s*date|posting\s*date|value\s*date|transaction\s*date|eff\.?\s*date)\b/
        .test(h)
    ) {
      indices.date = c;
      continue;
    }
    if (
      indices.description === -1 &&
      /\b(description|details|particulars|narrative|transaction|merchant|payee|reference|memo)\b/
        .test(h) &&
      !/\b(date|amount|balance|debit|credit)\b/.test(h)
    ) {
      indices.description = c;
      continue;
    }
    if (
      indices.debit === -1 &&
      /\b(debit|withdrawal|withdraw|paid\s*out|charge|dr|withdrawn|payment)\b/
        .test(h) &&
      !/\b(credit|balance)\b/.test(h)
    ) {
      indices.debit = c;
      continue;
    }
    if (
      indices.credit === -1 &&
      /\b(credit|deposit|paid\s*in|cr|funds\s*in|interest)\b/.test(h) &&
      !/\b(debit|balance)\b/.test(h)
    ) {
      indices.credit = c;
      continue;
    }
    if (
      indices.balance === -1 &&
      /\b(balance|running\s*balance|outstanding|ledger\s*balance)\b/.test(h)
    ) {
      indices.balance = c;
    }
  }

  /* If debit or credit wasn't found, try a generic "amount" column and
     classify based on sign. We leave both as -1 and handle it during parsing. */
  if (indices.debit === -1 && indices.credit === -1) {
    for (let c = 0; c < headerRow.length; c++) {
      const h = headerRow[c].toLowerCase().trim();
      if (
        /\b(amount|sum|value|total)\b/.test(h) &&
        c !== indices.date &&
        c !== indices.description &&
        c !== indices.balance
      ) {
        /* Store -2 as a sentinel meaning "single amount column" */
        indices.debit = -2;
        indices.credit = -2;
        break;
      }
    }
  }

  return indices;
}

function rowToTransaction(
  row: string[],
  cols: ColumnIndices,
): Transaction | null {
  /* Minimum requirement: we need either a date or a description */
  const rawDate =
    cols.date >= 0 && cols.date < row.length
      ? row[cols.date].trim()
      : "";
  const rawDesc =
    cols.description >= 0 && cols.description < row.length
      ? row[cols.description].trim()
      : "";

  /* Skip completely empty rows or subtotal/summary rows */
  const joined = row.join("").trim();
  if (!joined) return null;
  if (
    /^(total|sub-?total|closing|opening|balance)\b/i.test(rawDesc) &&
    !rawDate
  ) {
    return null;
  }

  const date = normalizeDate(rawDate);
  const description = rawDesc || joined;

  let debit: number | null = null;
  let credit: number | null = null;
  let balance = 0;

  /* Single amount column (debit = -2, credit = -2 sentinel) */
  if (cols.debit === -2 && cols.credit === -2) {
    const amountCol = cols.debit;
    /* Try the description-adjacent or last numeric column */
    const amountStr = findNumericColumn(row, cols);
    if (amountStr !== null) {
      const amount = parseAmount(amountStr);
      if (amount !== null) {
        if (amount < 0) {
          debit = Math.abs(amount);
        } else {
          credit = amount;
        }
      }
    }
  } else {
    /* Separate debit/credit columns */
    const debitStr =
      cols.debit >= 0 && cols.debit < row.length
        ? row[cols.debit].trim()
        : "";
    const creditStr =
      cols.credit >= 0 && cols.credit < row.length
        ? row[cols.credit].trim()
        : "";

    debit = debitStr ? parseAmount(debitStr) : null;
    credit = creditStr ? parseAmount(creditStr) : null;
  }

  /* Balance column */
  const balanceStr =
    cols.balance >= 0 && cols.balance < row.length
      ? row[cols.balance].trim()
      : "";
  balance = balanceStr ? parseAmount(balanceStr) ?? 0 : 0;

  /* Fallback: if we got neither debit nor credit, try to find any numeric
     value in the row (after date/description columns) */
  if (debit === null && credit === null && balance === 0) {
    const nums = row
      .map((c, i) => ({ idx: i, val: parseAmount(c.trim()) }))
      .filter((x) => x.val !== null && x.idx !== cols.date);

    if (nums.length === 1) {
      balance = nums[0].val!;
    } else if (nums.length >= 2) {
      /* Last numeric column is likely balance, second-last is amount */
      balance = nums[nums.length - 1].val!;
      const amt = nums[nums.length - 2].val!;
      if (amt < 0) debit = Math.abs(amt);
      else credit = amt;
    }
  }

  return {
    date: date || "1970-01-01",
    description: description || "(empty)",
    debit,
    credit,
    balance,
    fingerprint: fingerprint(
      date || "unknown",
      description,
      debit,
      credit,
      balance,
    ),
  };
}

function findNumericColumn(
  row: string[],
  cols: ColumnIndices,
): string | null {
  /* Try columns that aren't date, description, or balance */
  const exclude = new Set([cols.date, cols.description, cols.balance]);
  for (let c = row.length - 1; c >= 0; c--) {
    if (exclude.has(c)) continue;
    const val = row[c].trim();
    if (val && parseAmount(val) !== null) return val;
  }
  return null;
}

/* ---------- Fallback: scan entire matrix for date-amount patterns ---------- */

function fallbackParseTransactions(matrix: string[][]) {
  const transactions: Transaction[] = [];
  let openingBalance = 0;
  let closingBalance = 0;

  for (const row of matrix) {
    const joined = row.join(" ").trim();
    if (!joined) continue;

    /* Skip obvious non-transaction rows */
    if (/^(page|account|statement|period|opening|closing|total|continued)/i.test(joined)) {
      continue;
    }

    const tx = parseTransactionRowHeuristic(row);
    if (tx) {
      transactions.push(tx);
      closingBalance = tx.balance;
    }
  }

  return { transactions, openingBalance, closingBalance };
}

function parseTransactionRowHeuristic(row: string[]): Transaction | null {
  /* Look for a date in the first or second column */
  let date = "";
  let dateIdx = -1;

  for (let i = 0; i < Math.min(3, row.length); i++) {
    const candidate = normalizeDate(row[i].trim());
    if (candidate) {
      date = candidate;
      dateIdx = i;
      break;
    }
  }

  if (!date) return null;

  /* Collect all numeric values in the row */
  const numbers: { idx: number; val: number }[] = [];
  for (let i = 0; i < row.length; i++) {
    if (i === dateIdx) continue;
    const val = parseAmount(row[i].trim());
    if (val !== null) {
      numbers.push({ idx: i, val });
    }
  }

  if (numbers.length === 0) return null;

  /* Build description from non-numeric, non-date columns */
  const descParts: string[] = [];
  for (let i = 0; i < row.length; i++) {
    if (i === dateIdx) continue;
    if (!numbers.some((n) => n.idx === i)) {
      const cell = row[i].trim();
      if (cell) descParts.push(cell);
    }
  }
  const description = descParts.join(" ") || "(no description)";

  let debit: number | null = null;
  let credit: number | null = null;
  let balance = 0;

  if (numbers.length === 1) {
    balance = numbers[0].val;
  } else if (numbers.length === 2) {
    /* Could be: amount + balance, or debit + credit */
    const [a, b] = numbers.map((n) => n.val);
    if (a < 0) {
      debit = Math.abs(a);
      balance = b;
    } else if (b < 0) {
      credit = a;
      balance = Math.abs(b);
    } else if (a > b) {
      /* Larger is likely the running balance */
      balance = a;
      credit = b;
    } else {
      credit = a;
      balance = b;
    }
  } else {
    /* Multiple numbers — last is balance, second-last is amount */
    balance = numbers[numbers.length - 1].val;
    const amt = numbers[numbers.length - 2].val;
    if (amt < 0) debit = Math.abs(amt);
    else if (amt > 0) credit = amt;
  }

  return {
    date,
    description,
    debit,
    credit,
    balance,
    fingerprint: fingerprint(date, description, debit, credit, balance),
  };
}

/* ------------------------------------------------------------------ */
/*  PDF Parser                                                         */
/* ------------------------------------------------------------------ */

async function parsePDF(filePath: string): Promise<StatementParseResult> {
  const buffer = await readFile(filePath);
  const result = await extractText(buffer, { mergePages: true });
  const fullText: string = result.text;

  const lines = fullText.split("\n");

  /* Build the raw markdown by attempting column-aware table detection.
     We preserve every line as-is in the raw output. */
  const rawMarkdown = lines.join("\n");

  /* Parse structured data */
  const statement = extractStatementFromPDFText(lines);

  return {
    statement,
    rawMarkdown,
    cleanedMarkdown: rawMarkdown,
  };
}

interface PDFColumn {
  start: number;
  end: number;
  name: string;
  role: "date" | "description" | "debit" | "credit" | "balance" | "unknown";
}

function extractStatementFromPDFText(
  lines: string[],
): Statement {
  /* First, try to find a header line that defines the table columns.
     We look for lines containing column-like keywords in close proximity. */
  const headerIndex = findPDFHeaderLine(lines);
  const columns: PDFColumn[] = [];

  if (headerIndex !== -1) {
    const headerLine = lines[headerIndex];
    const detectedCols = detectPDFColumns(headerLine);
    columns.push(...detectedCols);
  }

  const transactions: Transaction[] = [];
  const accountName = extractAccountName(lines);
  const accountNumber = extractAccountNumber(lines);
  const statementPeriod = extractStatementPeriod(lines);

  /* Parse transaction lines */
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    /* Skip obvious non-transaction lines */
    if (
      /^(page\s+\d|continued|total|sub-?total|closing|opening)/i.test(line)
    ) {
      continue;
    }

    const tx = parsePDFTransactionLine(line, columns);
    if (tx) {
      transactions.push(tx);
    }
  }

  /* Fallback: if columns weren't detected, try spacing-based parsing */
  if (transactions.length === 0) {
    const { transactions: fallbackTx } = fallbackParsePDFLines(lines);
    transactions.push(...fallbackTx);
  }

  const closingBalance =
    transactions.length > 0
      ? transactions[transactions.length - 1].balance
      : 0;
  const openingBalance =
    transactions.length > 0 ? transactions[0].balance : 0;

  return {
    accountName: accountName || "Unknown Account",
    accountNumber: accountNumber || "",
    statementPeriod: statementPeriod.from
      ? statementPeriod
      : { from: "", to: "" },
    openingBalance,
    closingBalance,
    transactions: deduplicateTransactions(transactions),
  };
}

function findPDFHeaderLine(lines: string[]): number {
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
    /\bvalue\s*date\b/i,
    /\bposting\s*date\b/i,
  ];

  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const line = lines[i];
    let matchCount = 0;
    for (const kw of headerKeywords) {
      if (kw.test(line)) matchCount++;
    }
    if (matchCount >= 3) return i;
  }
  return -1;
}

function detectPDFColumns(headerLine: string): PDFColumn[] {
  const columns: PDFColumn[] = [];

  /* Tokenize by 2+ spaces (common in PDF text extraction) */
  const tokens = headerLine.split(/\s{2,}/).map((t) => t.trim());
  if (tokens.length >= 3) {
    for (const token of tokens) {
      const lower = token.toLowerCase();
      let role: PDFColumn["role"] = "unknown";

      if (/^date/i.test(lower) || /^value\s*date/i.test(lower) || /^posting\s*date/i.test(lower) || /^tran/i.test(lower)) {
        role = "date";
      } else if (/^debit/i.test(lower) || /^withdrawal/i.test(lower) || /^charge/i.test(lower) || /^dr/i.test(lower)) {
        role = "debit";
      } else if (/^credit/i.test(lower) || /^deposit/i.test(lower) || /^cr/i.test(lower)) {
        role = "credit";
      } else if (/^balance/i.test(lower) || /^outstanding/i.test(lower)) {
        role = "balance";
      } else if (
        /^description/i.test(lower) ||
        /^details/i.test(lower) ||
        /^particulars/i.test(lower) ||
        /^narrative/i.test(lower) ||
        /^transaction/i.test(lower) ||
        /^merchant/i.test(lower) ||
        /^payee/i.test(lower) ||
        /^reference/i.test(lower)
      ) {
        role = "description";
      }

      columns.push({
        start: 0,
        end: 0,
        name: token,
        role,
      });
    }
    return columns;
  }

  /* Fallback: try single-space tokenization with keyword matching */
  const words = headerLine.split(/\s+/).filter(Boolean);
  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
    let role: PDFColumn["role"] = "unknown";
    if (/^date$/i.test(clean) || /^tran/i.test(clean)) role = "date";
    else if (/^debit$/i.test(clean) || /^dr$/i.test(clean) || /^withdrawal/i.test(clean)) role = "debit";
    else if (/^credit$/i.test(clean) || /^cr$/i.test(clean) || /^deposit/i.test(clean)) role = "credit";
    else if (/^balance/i.test(clean)) role = "balance";
    else if (
      /^desc/i.test(clean) ||
      /^detail/i.test(clean) ||
      /^partic/i.test(clean) ||
      /^narr/i.test(clean) ||
      /^trans/i.test(clean) ||
      /^memo/i.test(clean)
    )
      role = "description";

    columns.push({
      start: 0,
      end: 0,
      name: word,
      role,
    });
  }

  return columns;
}

function parsePDFTransactionLine(
  line: string,
  columns: PDFColumn[],
): Transaction | null {
  /* If we have good column detection, split by 2+ spaces */
  if (columns.length >= 3) {
    const parts = line.split(/\s{2,}/).map((p) => p.trim());

    if (parts.length >= 2) {
      const dateIdx = columns.findIndex((c) => c.role === "date");
      const descIdx = columns.findIndex((c) => c.role === "description");
      const debitIdx = columns.findIndex((c) => c.role === "debit");
      const creditIdx = columns.findIndex((c) => c.role === "credit");
      const balIdx = columns.findIndex((c) => c.role === "balance");

      const rawDate =
        dateIdx >= 0 && dateIdx < parts.length ? parts[dateIdx] : parts[0];
      const date = normalizeDate(rawDate);
      if (!date) return null;

      const description =
        descIdx >= 0 && descIdx < parts.length
          ? parts[descIdx]
          : parts.slice(1, parts.length - 1).join(" ") ||
            "(no description)";

      let debit: number | null = null;
      let credit: number | null = null;
      let balance = 0;

      if (debitIdx >= 0 && debitIdx < parts.length) {
        debit = parseAmount(parts[debitIdx]);
      }
      if (creditIdx >= 0 && creditIdx < parts.length) {
        credit = parseAmount(parts[creditIdx]);
      }
      if (balIdx >= 0 && balIdx < parts.length) {
        balance = parseAmount(parts[balIdx]) ?? 0;
      } else if (parts.length >= 2) {
        /* Estimate balance from last numeric part */
        const lastPart = parts[parts.length - 1];
        balance = parseAmount(lastPart) ?? 0;
        if (!creditIdx && !debitIdx && parts.length >= 3) {
          const amtPart = parts[parts.length - 2];
          const amt = parseAmount(amtPart);
          if (amt !== null) {
            if (amt < 0) debit = Math.abs(amt);
            else credit = amt;
          }
        }
      }

      return {
        date,
        description,
        debit,
        credit,
        balance,
        fingerprint: fingerprint(date, description, debit, credit, balance),
      };
    }
  }

  /* Fallback: use heuristic parsing (date + numbers) */
  return parseTransactionLineHeuristic(line);
}

function parseTransactionLineHeuristic(
  line: string,
): Transaction | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  /* Try to extract date at the start of the line */
  const dateMatch = trimmed.match(
    /^(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
  );
  if (!dateMatch) return null;

  const date = normalizeDate(dateMatch[1]);
  if (!date) return null;

  /* Remove the date from the line */
  const rest = trimmed.slice(dateMatch[0].length).trim();

  /* Extract all numeric values (amounts) from the rest */
  const amountMatches = [
    ...rest.matchAll(
      /[-]?(?:\$|EUR|USD|GBP)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    ),
  ];

  const amounts = amountMatches
    .map((m) => {
      const val = parseFloat(m[1].replace(/,/g, ""));
      /* Check if there's a minus sign before the amount */
      const before = rest.slice(
        Math.max(0, m.index! - 2),
        m.index!,
      );
      return before.includes("-") || before.includes("(") ? -val : val;
    })
    .filter((v) => !isNaN(v));

  if (amounts.length === 0) return null;

  let debit: number | null = null;
  let credit: number | null = null;
  let balance = 0;

  if (amounts.length === 1) {
    balance = amounts[0];
  } else if (amounts.length === 2) {
    const [a, b] = amounts;
    if (a < 0) {
      debit = Math.abs(a);
      balance = b;
    } else if (b < 0) {
      credit = a;
      balance = Math.abs(b);
    } else {
      /* Larger is likely balance */
      balance = Math.max(a, b);
      const amt = Math.min(a, b);
      credit = amt;
    }
  } else {
    balance = amounts[amounts.length - 1];
    const amt = amounts[amounts.length - 2];
    if (amt < 0) debit = Math.abs(amt);
    else credit = amt;
  }

  const description =
    rest.replace(/[-]?(?:\$|EUR|USD|GBP)?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})/g, "").trim() ||
    "(no description)";

  return {
    date,
    description,
    debit,
    credit,
    balance,
    fingerprint: fingerprint(date, description, debit, credit, balance),
  };
}

function fallbackParsePDFLines(lines: string[]) {
  const transactions: Transaction[] = [];
  const datePattern =
    /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    /* Skip header/footer lines */
    if (
      /^(page|account|statement|period|continued|total|sub-?total)/i.test(
        trimmed,
      )
    ) {
      continue;
    }

    /* Look for lines starting with a date */
    if (!datePattern.test(trimmed)) continue;

    const tx = parseTransactionLineHeuristic(trimmed);
    if (tx) transactions.push(tx);
  }

  return { transactions };
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

const DATE_FORMATS = [
  // DD/MM/YYYY or DD-MM-YYYY
  {
    re: /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/,
    fn: (_: string, d: string, m: string, y: string) =>
      `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`,
  },
  // DD/MM/YY
  {
    re: /^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/,
    fn: (_: string, d: string, m: string, y: string) => {
      const yy = +y < 50 ? `20${y}` : `19${y}`;
      return `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    },
  },
  // YYYY-MM-DD (already normalized)
  {
    re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    fn: (_: string, y: string, m: string, d: string) =>
      `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`,
  },
  // DD-Mon-YYYY or DD-Mon-YY (e.g. "01-Jan-2024" or "01-Jan-24")
  {
    re: /^(\d{1,2})[-/](\w{3})[-/](\d{2,4})$/,
    fn: (_: string, d: string, mon: string, y: string) => {
      const months: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
      };
      const m = months[mon.toLowerCase().slice(0, 3)];
      if (!m) return "";
      const yy = y.length === 2
        ? (+y < 50 ? `20${y}` : `19${y}`)
        : y;
      return `${yy}-${m}-${d.padStart(2, "0")}`;
    },
  },
];

function normalizeDate(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.trim();
  if (!cleaned) return "";

  for (const fmt of DATE_FORMATS) {
    const m = cleaned.match(fmt.re);
    if (m) {
      const result = fmt.fn(cleaned, m[1], m[2], m[3]);
      if (result) return result;
    }
  }
  return "";
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  /* Handle parentheses for negatives: (1,234.56) -> -1234.56 */
  let negative = false;
  let cleaned = trimmed;

  if (/^\(.*\)$/.test(trimmed)) {
    negative = true;
    cleaned = trimmed.slice(1, -1);
  }

  /* Strip currency symbols and whitespace */
  cleaned = cleaned.replace(/^[£$€¥₩₹₽₱₿€\s]+/, "").replace(/[£$€¥₩₹₽₱₿€\s]+$/, "");

  /* Handle leading minus */
  if (cleaned.startsWith("-")) {
    negative = true;
    cleaned = cleaned.slice(1);
  }

  /* Remove commas and parse */
  const numeric = cleaned.replace(/,/g, "");
  const val = parseFloat(numeric);
  if (isNaN(val)) return null;

  return negative ? -val : val;
}

function extractAccountName(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/account\s+(?:name\s+)?[:\s]+(.+)/i);
    if (m) return m[1].trim();
  }
  /* Fallback: first non-empty, non-date line that looks like a bank name */
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      trimmed.length > 3 &&
      trimmed.length < 60 &&
      !/\d/.test(trimmed) &&
      !/^(page|date|statement|period)/i.test(trimmed)
    ) {
      return trimmed;
    }
  }
  return "";
}

function extractAccountNumber(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(
      /(?:account|acct)\s*(?:#|no|number|\.|\s+)[:\s]*([A-Za-z0-9\-]+)/i,
    );
    if (m) return m[1].trim();
  }
  return "";
}

function extractStatementPeriod(lines: string[]): {
  from: string;
  to: string;
} {
  for (const line of lines) {
    const m = line.match(
      /(?:from|period|statement)\s+(?:period\s+)?(?:from\s+)?(\S[-\/\w]+)\s+(?:to|through|thru|-)\s+(\S[-\/\w]+)/i,
    );
    if (m) {
      return {
        from: normalizeDate(m[1]) || m[1],
        to: normalizeDate(m[2]) || m[2],
      };
    }
  }
  return { from: "", to: "" };
}

function deduplicateTransactions(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return transactions.filter((tx) => {
    if (seen.has(tx.fingerprint)) return false;
    seen.add(tx.fingerprint);
    return true;
  });
}
