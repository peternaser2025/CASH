export type TransactionType = 'Income' | 'Expense' | 'Transfer';

export interface Transaction {
  id?: number;
  date: string;
  employee: string;
  branch: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  sender?: string;
  receiver?: string;
}

export interface ReportFilter {
  employee?: string;
  branch?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

export interface EmployeeBalance {
  name: string;
  balance: number;
}

export interface ReportData {
  openingBalance: string;
  rows: any[][];
  finalBalance: string;
}
