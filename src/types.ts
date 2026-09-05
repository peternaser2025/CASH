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
  targetMonth?: string;
}

export interface ReportFilter {
  employee?: string;
  branch?: string;
  category?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

export interface EmployeeBalance {
  name: string;
  balance: number;
}

export interface ReportData {
  openingBalance?: string;
  rows: any[][];
  finalBalance?: string;
  total?: number;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export type OrderType = 'purchase' | 'supply' | 'customer' | 'branch_transfer';
export type OrderStatus = 'pending' | 'in_progress' | 'shipped' | 'delivered' | 'cancelled' | 'delayed';
export type OrderPriority = 'urgent' | 'high' | 'normal' | 'low';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface Order {
  id: string;
  orderNumber: string;
  title: string;
  type: OrderType;
  supplierOrCustomer: string;
  branch: string;
  orderDate: string;
  deliveryDueDate: string;
  actualDeliveryDate?: string;
  amount: number;
  paidAmount: number;
  status: OrderStatus;
  priority: OrderPriority;
  paymentStatus: PaymentStatus;
  assignedEmployee?: string;
  contactPhone?: string;
  items: OrderItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// Unified API Response Wrapper
// ----------------------------------------------------
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    timestamp?: string;
    count?: number;
    [key: string]: any;
  };
}

// ----------------------------------------------------
// Audit Trail & Change Logging
// ----------------------------------------------------
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RECONCILE' | 'SETTLE';
export type AuditEntityType = 'TRANSACTION' | 'BALANCE' | 'ORDER' | 'SETTLEMENT' | 'SETTINGS';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  actor: string;
  description: string;
  previousValue?: any;
  newValue?: any;
}

// ----------------------------------------------------
// Financial Reconciliation Check
// ----------------------------------------------------
export interface ReconciliationItem {
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

export interface ReconciliationReport {
  timestamp: string;
  isSystemBalanced: boolean;
  totalDiscrepancyFils: number;
  totalDiscrepancyKWD: number;
  totalTransactionsEvaluated: number;
  items: ReconciliationItem[];
}
