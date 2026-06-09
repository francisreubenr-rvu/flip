import { readFile, writeFile, access } from "fs/promises";
import { constants } from "fs";
import { generateFingerprint, findNewTransactions } from "@/lib/ledger/dedup";
import type { Transaction, Ledger } from "@/lib/ledger/types";

/**
 * Path to the persisted ledger markdown file.
 *
 * NOTE: The user originally requested `/need-welp/ledger.md` but that
 * path sits on a read-only filesystem on this machine.  The file is
 * placed inside the project directory at `need-welp/` instead.
 */
const LEDGER_PATH = `${process.cwd()}/need-welp/ledger.md`;

// ---------------------------------------------------------------------------
// Markdown serialisation helpers
// ---------------------------------------------------------------------------

/**
 * Parse a single markdown table row into a Transaction.
 *
 * Expected format (pipe-delimited):
 *   | date | description | debit | credit | balance |
 *
 * The header row and separator row are skipped.  Rows may optionally
 * start/end with whitespace or a pipe character.
 */
function parseRow(line: string): Transaction | null {
  const trimmed = line.trim();

  // Skip header / separator rows also avoid treating decorated
  // boundaries as data.
  if (
    !trimmed.startsWith("|") ||
    trimmed.startsWith("|---") ||
    trimmed.startsWith("| Date")
  ) {
    return null;
  }

  // Strip leading/trailing pipe, then split on unescaped pipes.
  const cells = trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

  if (cells.length < 5) return null;

  const parseNum = (raw: string): number | null => {
    const cleaned = raw.replace(/[,$]/g, "");
    if (!cleaned || cleaned === "" || cleaned === "-") return null;
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? null : n;
  };

  const debit = parseNum(cells[2]);
  const credit = parseNum(cells[3]);
  const balance = parseFloat(cells[4].replace(/[,$]/g, ""));

  if (Number.isNaN(balance)) return null;

  const description = cells[1].trim();
  const date = cells[0].trim();

  const tx: Omit<Transaction, "fingerprint"> = {
    date,
    description,
    debit,
    credit,
    balance,
  };

  return { ...tx, fingerprint: generateFingerprint(tx) };
}

/**
 * Serialize a single Transaction to a markdown table row.
 */
function formatRow(tx: Transaction): string {
  const fmt = (n: number | null): string =>
    n !== null ? n.toFixed(2) : "";
  return `| ${tx.date} | ${tx.description} | ${fmt(tx.debit)} | ${fmt(tx.credit)} | ${tx.balance.toFixed(2)} |`;
}

// ---------------------------------------------------------------------------
// Ledger I/O
// ---------------------------------------------------------------------------

/**
 * Read the persisted ledger from the markdown file at `LEDGER_PATH`.
 *
 * If the file does not exist an empty Ledger is returned.
 */
export async function readLedger(): Promise<Ledger> {
  try {
    await access(LEDGER_PATH, constants.R_OK);
  } catch {
    return { entries: [], lastUpdated: "never" };
  }

  const content = await readFile(LEDGER_PATH, "utf-8");
  const lines = content.split("\n");

  const entries: Transaction[] = [];
  let lastUpdated = "never";

  for (const line of lines) {
    // Capture "Last updated:" value from the header
    const updateMatch = line.match(/^Last updated:\s*(.+)$/i);
    if (updateMatch) {
      lastUpdated = updateMatch[1].trim();
    }

    const tx = parseRow(line);
    if (tx) {
      entries.push(tx);
    }
  }

  return { entries, lastUpdated };
}

/**
 * Write the in-memory ledger to the markdown file at `LEDGER_PATH`.
 */
export async function writeLedger(ledger: Ledger): Promise<void> {
  const header = [
    "# Ledger",
    "",
    `Last updated: ${ledger.lastUpdated}`,
    "",
    "## Transactions",
    "",
    `No transactions yet.`,
    "",
    "| Date | Description | Debit | Credit | Balance |",
    "|---|---|---|---|---|",
  ];

  const rows =
    ledger.entries.length > 0
      ? ledger.entries.map(formatRow)
      : [];

  // Remove the "No transactions yet." placeholder when there are entries.
  const body =
    ledger.entries.length > 0
      ? [...header.slice(0, 5), ...header.slice(7), ...rows, ""].join("\n")
      : [...header, ...rows, ""].join("\n");

  await writeFile(LEDGER_PATH, body, "utf-8");
}

// ---------------------------------------------------------------------------
// High-level update
// ---------------------------------------------------------------------------

/**
 * Merge incoming transactions into the ledger:
 *
 * 1. Read the existing ledger from disk.
 * 2. Deduplicate against existing entries (by fingerprint).
 * 3. Sort chronologically by date, then by balance (ascending).
 * 4. Recalculate running balance.
 * 5. Write the updated ledger back to disk.
 * 6. Return the updated Ledger.
 */
export async function updateLedger(
  newTransactions: Transaction[],
): Promise<Ledger> {
  const existing = await readLedger();

  // Ensure every incoming tx has a fingerprint.
  const fullyQualified: Transaction[] = newTransactions.map((tx) => {
    if (tx.fingerprint) return tx;
    const { fingerprint: _fp, ...rest } = tx;
    return { ...rest, fingerprint: generateFingerprint(rest) };
  });

  // Deduplicate.
  const fresh = findNewTransactions(existing.entries, fullyQualified);

  if (fresh.length === 0) {
    // Nothing new to add.
    existing.lastUpdated = new Date().toISOString();
    await writeLedger(existing);
    return existing;
  }

  // Merge and sort: date ascending, then balance ascending.
  const merged = [...existing.entries, ...fresh].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    // For same-date entries, sort by balance ascending (typically deposits
    // accumulate, so earlier-in-day entries have lower balances).
    return a.balance - b.balance;
  });

  // Recalculate running balance.
  // The first entry carries its supplied balance (it is the opening).
  // Every subsequent entry's balance is recalculated as:
  //   previous_balance + (credit ?? 0) - (debit ?? 0)
  // but we keep the *original* balance if no debit/credit is present,
  // otherwise the running sum drifts.
  // Approach: trust the first entry's balance, then recompute forward.
  const recalculated: Transaction[] = [merged[0]];
  for (let i = 1; i < merged.length; i++) {
    const prev = recalculated[i - 1];
    const cur = merged[i];
    const delta = (cur.credit ?? 0) - (cur.debit ?? 0);
    const newBalance = prev.balance + delta;
    recalculated.push({
      ...cur,
      balance: Math.round(newBalance * 100) / 100, // avoid floating-point drift
    });
  }

  const updated: Ledger = {
    entries: recalculated,
    lastUpdated: new Date().toISOString(),
  };

  await writeLedger(updated);
  return updated;
}
