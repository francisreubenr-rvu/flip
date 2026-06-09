import { createHash } from "crypto";
import type { Transaction } from "@/lib/ledger/types";

/**
 * Normalize a description for fingerprinting:
 * - Trim whitespace
 * - Collapse internal whitespace to single spaces
 * - Lowercase
 */
function normalizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Generate a deterministic SHA256 fingerprint for a transaction.
 *
 * The fingerprint is computed from a concatenation of:
 *   date + normalized description + debit|credit formatted + balance
 *
 * All numeric values are formatted to 2 decimal places and the null value for
 * debit/credit is represented as "NONE" so that a missing side is consistently
 * fingerprinted.
 */
export function generateFingerprint(
  tx: Omit<Transaction, "fingerprint">,
): string {
  const parts = [
    tx.date,
    normalizeDescription(tx.description),
    tx.debit !== null ? tx.debit.toFixed(2) : "NONE",
    tx.credit !== null ? tx.credit.toFixed(2) : "NONE",
    tx.balance.toFixed(2),
  ];
  const hash = createHash("sha256");
  hash.update(parts.join("|"));
  return hash.digest("hex");
}

/**
 * Return only transactions that are NOT already present in `existing`,
 * matched by fingerprint.
 */
export function findNewTransactions(
  existing: Transaction[],
  incoming: Transaction[],
): Transaction[] {
  const existingFingerprints = new Set(
    existing.map((tx) => tx.fingerprint),
  );
  return incoming.filter(
    (tx) => !existingFingerprints.has(tx.fingerprint),
  );
}

/**
 * Check whether a list of transactions contains any duplicate fingerprints.
 */
export function hasDuplicates(transactions: Transaction[]): boolean {
  const seen = new Set<string>();
  for (const tx of transactions) {
    if (seen.has(tx.fingerprint)) {
      return true;
    }
    seen.add(tx.fingerprint);
  }
  return false;
}
