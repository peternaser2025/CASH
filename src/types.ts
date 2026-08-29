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
