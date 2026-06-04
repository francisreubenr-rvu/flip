import { NextRequest, NextResponse } from 'next/server';
import { readLedger, updateLedger } from '@/lib/ledger/ledger';
import type { Transaction } from '@/lib/ledger/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    const ledger = await readLedger();
    let transactions: Transaction[] = ledger.entries;

    // Filter by date range (inclusive)
    if (dateFrom) {
      transactions = transactions.filter((tx) => tx.date >= dateFrom);
    }
    if (dateTo) {
      transactions = transactions.filter((tx) => tx.date <= dateTo);
    }

    // Filter by description search (case-insensitive)
    if (search) {
      const term = search.toLowerCase();
      transactions = transactions.filter((tx) =>
        tx.description.toLowerCase().includes(term),
      );
    }

    // Sort by date descending (newest first)
    const sorted = [...transactions].sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    return NextResponse.json({
      success: true,
      transactions: sorted,
      total: ledger.entries.length,
      filtered: sorted.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read ledger';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { transactions: Transaction[] };

    if (!Array.isArray(body.transactions)) {
      return NextResponse.json(
        { success: false, error: 'transactions array is required' },
        { status: 400 },
      );
    }

    // Compute how many transactions existed before the update
    const before = await readLedger();
    const beforeCount = before.entries.length;

    const ledger = await updateLedger(body.transactions);

    const added =
      ledger.entries.length - beforeCount >= 0
        ? ledger.entries.length - beforeCount
        : body.transactions.length;

    return NextResponse.json({
      success: true,
      added,
      ledger,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update ledger';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
