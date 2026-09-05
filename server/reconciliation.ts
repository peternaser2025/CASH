export interface ReconciliationResultItem {
  entityType: 'employee' | 'branch';
  name: string;
  id: string;
  storedBalanceFils: number;
  storedBalanceKWD: number;
  calculatedBalanceFils: number;
  calculatedBalanceKWD: number;
  discrepancyFils: number;
  discrepancyKWD: number;
  totalIncomeFils: number;
  totalExpenseFils: number;
  transactionsCount: number;
  status: 'balanced' | 'discrepancy_detected';
}

export interface FullReconciliationReport {
  timestamp: string;
  isSystemBalanced: boolean;
  totalDiscrepancyFils: number;
  totalDiscrepancyKWD: number;
  totalTransactionsEvaluated: number;
  items: ReconciliationResultItem[];
}

export function performReconciliation(
  transactions: any[],
  employees: { name: string; balance: number }[],
  branches: string[]
): FullReconciliationReport {
  const items: ReconciliationResultItem[] = [];
  let totalDiscrepancyFils = 0;

  // 1. Employee Reconciliation
  employees.forEach((emp) => {
    const empTxs = transactions.filter(t => t.employee === emp.name);
    
    let incFils = 0;
    let expFils = 0;

    empTxs.forEach(t => {
      const fils = Math.round((parseFloat(t.amount) || 0) * 1000);
      const isInc = t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'إيراد' || t.type === 'تغذية عهدة';
      const isExp = t.type === 'Expense' || t.type === 'Transfer-Out' || t.type === 'مصروف';

      if (isInc) incFils += fils;
      if (isExp) expFils += fils;
    });

    const calculatedBalanceFils = incFils - expFils;
    const storedBalanceFils = Math.round((emp.balance || 0) * 1000);
    const diffFils = storedBalanceFils - calculatedBalanceFils;

    const isBalanced = diffFils === 0;
    if (!isBalanced) {
      totalDiscrepancyFils += Math.abs(diffFils);
    }

    items.push({
      entityType: 'employee',
      name: emp.name,
      id: `emp_${emp.name.replace(/\s+/g, '_')}`,
      storedBalanceFils,
      storedBalanceKWD: storedBalanceFils / 1000,
      calculatedBalanceFils,
      calculatedBalanceKWD: calculatedBalanceFils / 1000,
      discrepancyFils: diffFils,
      discrepancyKWD: diffFils / 1000,
      totalIncomeFils: incFils,
      totalExpenseFils: expFils,
      transactionsCount: empTxs.length,
      status: isBalanced ? 'balanced' : 'discrepancy_detected'
    });
  });

  return {
    timestamp: new Date().toISOString(),
    isSystemBalanced: totalDiscrepancyFils === 0,
    totalDiscrepancyFils,
    totalDiscrepancyKWD: totalDiscrepancyFils / 1000,
    totalTransactionsEvaluated: transactions.length,
    items
  };
}
