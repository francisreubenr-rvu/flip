export interface Transaction {
  date: string;           // YYYY-MM-DD
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  fingerprint: string;    // SHA256 hex of date+description+debit+credit+balance
}

export interface Statement {
  accountName: string;
  accountNumber: string;
  statementPeriod: { from: string; to: string };
  openingBalance: number;
  closingBalance: number;
  transactions: Transaction[];
}

export interface Ledger {
  entries: Transaction[];
  lastUpdated: string;
}

export interface StatementParseResult {
  statement: Statement;
  rawMarkdown: string;    // full table-as-markdown, zero loss
  cleanedMarkdown: string; // stripped of headers/footers/boilerplate
}
