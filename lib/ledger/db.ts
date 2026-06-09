import type { PostgrestError } from "@supabase/supabase-js";
import { getServerClient, isSupabaseConfigured } from "@/lib/ledger/supabase-server";
import { readLedger, updateLedger } from "@/lib/ledger/ledger";
import type { Transaction, Ledger } from "@/lib/ledger/types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Shape of a row returned from the `transactions` table.
 * Used to manually type Supabase responses in the absence of schema types.
 */
const TABLE = "ledger_entries";

interface TransactionRow {
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  fingerprint: string;
}

interface FingerprintRow {
  fingerprint: string;
}

/**
 * Map a database row to the application-level Transaction type.
 */
function rowToTransaction(row: TransactionRow): Transaction {
  return {
    date: row.date,
    description: row.description,
    debit: row.debit != null ? Number(row.debit) : null,
    credit: row.credit != null ? Number(row.credit) : null,
    balance: Number(row.balance),
    fingerprint: row.fingerprint,
  };
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

/**
 * Insert new transactions into the Supabase `transactions` table,
 * deduplicating by `fingerprint`.
 *
 * 1. Queries which of the incoming fingerprints already exist.
 * 2. Inserts only the truly new rows.
 * 3. If Supabase is unavailable, falls back to the local filesystem ledger.
 *
 * @returns The number of newly inserted rows.
 */
export async function upsertTransactions(
  transactions: Transaction[],
): Promise<{ added: number }> {
  if (transactions.length === 0) return { added: 0 };

  // -- Supabase path ---------------------------------------------------------
  if (isSupabaseConfigured()) {
    const supabase = getServerClient();
    if (supabase) {
      try {
        // 1. Discover which fingerprints already exist.
        const fingerprints = transactions.map((t) => t.fingerprint);
        const existing = new Set<string>();

        for (let i = 0; i < fingerprints.length; i += 100) {
          const batch = fingerprints.slice(i, i + 100);
          const { data, error } = (await supabase
            .from(TABLE)
            .select("fingerprint")
            .in("fingerprint", batch)) as unknown as {
            data: FingerprintRow[] | null;
            error: PostgrestError | null;
          };

          if (error) throw error;
          for (const row of data ?? []) {
            existing.add(row.fingerprint);
          }
        }

        // 2. Keep only truly new transactions.
        const fresh = transactions.filter((t) => !existing.has(t.fingerprint));
        if (fresh.length === 0) return { added: 0 };

        // 3. Insert them.
        const rows: TransactionRow[] = fresh.map((t) => ({
          date: t.date,
          description: t.description,
          debit: t.debit,
          credit: t.credit,
          balance: t.balance,
          fingerprint: t.fingerprint,
        }));

        const { error: insertError, count } = (await supabase
          .from(TABLE)
          .insert(rows as never[], { count: "exact" })) as unknown as {
          error: PostgrestError | null;
          count: number | null;
        };

        if (insertError) throw insertError;

        return { added: count ?? fresh.length };
      } catch (err) {
        console.warn(
          "[ledger/db] Supabase upsert failed, falling back to filesystem:",
          err instanceof Error ? err.message : err,
        );
        // Fall through to filesystem fallback.
      }
    }
  }

  // -- Filesystem fallback ---------------------------------------------------
  try {
    const existing = await readLedger();
    const updated = await updateLedger(transactions);
    const added = updated.entries.length - existing.entries.length;
    return { added: Math.max(0, added) };
  } catch (fsErr) {
    console.error(
      "[ledger/db] Filesystem fallback also failed:",
      fsErr instanceof Error ? fsErr.message : fsErr,
    );
    return { added: 0 };
  }
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Options for filtering transactions.
 */
export interface QueryOptions {
  dateFrom?: string; // YYYY-MM-DD inclusive lower bound
  dateTo?: string; // YYYY-MM-DD inclusive upper bound
  search?: string; // Case-insensitive substring match on description
  sortDir?: "asc" | "desc"; // Sort direction by date (default: desc)
}

/**
 * Query the transactions table with optional filters.
 *
 * Falls back to the filesystem ledger when Supabase is not available.
 */
export async function queryTransactions(
  opts?: QueryOptions,
): Promise<{ transactions: Transaction[]; lastUpdated: string }> {
  const { dateFrom, dateTo, search, sortDir } = opts ?? {};

  // -- Supabase path ---------------------------------------------------------
  if (isSupabaseConfigured()) {
    const supabase = getServerClient();
    if (supabase) {
      try {
        let query = supabase.from(TABLE).select("*");

        if (dateFrom) {
          query = query.gte("date", dateFrom);
        }
        if (dateTo) {
          query = query.lte("date", dateTo);
        }
        if (search) {
          query = query.ilike("description", `%${search}%`);
        }

        const ascending = sortDir === "asc";
        query = query.order("date", { ascending });

        const { data, error } = (await query) as unknown as {
          data: TransactionRow[] | null;
          error: PostgrestError | null;
        };

        if (error) throw error;

        const transactions: Transaction[] = (data ?? []).map(rowToTransaction);

        return {
          transactions,
          lastUpdated: new Date().toISOString(),
        };
      } catch (err) {
        console.warn(
          "[ledger/db] Supabase query failed, falling back to filesystem:",
          err instanceof Error ? err.message : err,
        );
        // Fall through to filesystem fallback.
      }
    }
  }

  // -- Filesystem fallback ---------------------------------------------------
  try {
    const ledger = await readLedger();
    return filterLedgerLocally(ledger, { dateFrom, dateTo, search, sortDir });
  } catch (fsErr) {
    console.error(
      "[ledger/db] Filesystem fallback also failed:",
      fsErr instanceof Error ? fsErr.message : fsErr,
    );
    return { transactions: [], lastUpdated: "never" };
  }
}

/**
 * Apply filter/sort logic to an in-memory Ledger (filesystem fallback).
 */
function filterLedgerLocally(
  ledger: Ledger,
  opts: QueryOptions,
): { transactions: Transaction[]; lastUpdated: string } {
  let entries = ledger.entries;

  // Date range filter.
  if (opts.dateFrom) {
    entries = entries.filter((t) => t.date >= opts.dateFrom!);
  }
  if (opts.dateTo) {
    entries = entries.filter((t) => t.date <= opts.dateTo!);
  }

  // Description search (case-insensitive).
  if (opts.search) {
    const q = opts.search.toLowerCase();
    entries = entries.filter((t) => t.description.toLowerCase().includes(q));
  }

  // Sort by date.
  const ascending = opts.sortDir !== "desc"; // default to desc
  entries = [...entries].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    return ascending ? cmp : -cmp;
  });

  return { transactions: entries, lastUpdated: ledger.lastUpdated };
}

// ---------------------------------------------------------------------------
// Count
// ---------------------------------------------------------------------------

/**
 * Get the total number of transactions in the database.
 *
 * Falls back to the filesystem ledger length when Supabase is not available.
 */
export async function getTransactionCount(): Promise<number> {
  // -- Supabase path ---------------------------------------------------------
  if (isSupabaseConfigured()) {
    const supabase = getServerClient();
    if (supabase) {
      try {
        const { count, error } = (await supabase
          .from(TABLE)
          .select("*", { count: "exact", head: true })) as unknown as {
          count: number | null;
          error: PostgrestError | null;
        };

        if (error) throw error;
        return count ?? 0;
      } catch (err) {
        console.warn(
          "[ledger/db] Supabase count query failed, falling back to filesystem:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  // -- Filesystem fallback ---------------------------------------------------
  try {
    const ledger = await readLedger();
    return ledger.entries.length;
  } catch {
    return 0;
  }
}
