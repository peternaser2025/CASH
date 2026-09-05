import { EmployeeBalance, Order, ReportFilter, ReportData, Transaction } from '../types';

export const apiService = {
  // 1. Health & Server Status
  async getHealth(): Promise<any> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Backend health check warning:', e);
      return null;
    }
  },

  // 2. Settings (Branches & Categories)
  async getSettings(): Promise<{ branches: string[]; categories: string[] } | null> {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Backend getSettings failed:', e);
      return null;
    }
  },

  async updateSettings(branches: string[], categories: string[]): Promise<boolean> {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branches, categories })
      });
      return res.ok;
    } catch (e) {
      console.warn('Backend updateSettings failed:', e);
      return false;
    }
  },

  // 3. Transactions CRUD
  async getTransactions(filters?: Partial<ReportFilter>): Promise<ReportData | null> {
    try {
      const params = new URLSearchParams();
      if (filters?.branch) params.append('branch', filters.branch);
      if (filters?.employee) params.append('employee', filters.employee);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        rows: data.rows || [],
        total: data.total || (data.rows ? data.rows.length : 0)
      };
    } catch (e) {
      console.warn('Backend getTransactions failed:', e);
      return null;
    }
  },

  async addTransaction(transaction: any): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction)
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, error: e.message || 'خطأ في الاتصال بالخادم' };
    }
  },

  async updateTransaction(id: string, data: any): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async deleteTransaction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // 4. Balances
  async getBalances(): Promise<EmployeeBalance[] | null> {
    try {
      const res = await fetch('/api/balances');
      if (!res.ok) return null;
      const data = await res.json();
      return data.balances || [];
    } catch (e) {
      console.warn('Backend getBalances failed:', e);
      return null;
    }
  },

  // 5. Employees
  async getEmployees(): Promise<{ name: string; balance: number }[] | null> {
    try {
      const res = await fetch('/api/employees');
      if (!res.ok) return null;
      const data = await res.json();
      return data.employees || [];
    } catch (e) {
      return null;
    }
  },

  async addEmployee(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async deleteEmployee(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // 6. Orders
  async getOrders(): Promise<Order[]> {
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) return [];
      const data = await res.json();
      return data.orders || [];
    } catch (e) {
      return [];
    }
  },

  async saveOrder(order: Partial<Order>): Promise<{ success: boolean; order?: Order; error?: string }> {
    try {
      if (order.id) {
        const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        });
        return await res.json();
      } else {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        });
        return await res.json();
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async deleteOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // 7. Budgets
  async getBudgets(): Promise<any[]> {
    try {
      const res = await fetch('/api/budgets');
      if (!res.ok) return [];
      const data = await res.json();
      return data.budgets || [];
    } catch (e) {
      return [];
    }
  },

  async saveBudgets(budgets: any[]): Promise<boolean> {
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgets })
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  // 8. Settlements
  async getSettlements(): Promise<any[]> {
    try {
      const res = await fetch('/api/settlements');
      if (!res.ok) return [];
      const data = await res.json();
      return data.settlements || [];
    } catch (e) {
      return [];
    }
  },

  async saveSettlement(settlement: any): Promise<{ success: boolean; settlement?: any }> {
    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settlement)
      });
      return await res.json();
    } catch (e) {
      return { success: false };
    }
  },

  // 9. Full Sync
  async syncAll(payload: {
    transactions?: any[];
    employees?: any[];
    orders?: any[];
    settings?: { branches?: string[]; categories?: string[] };
  }): Promise<any> {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Backend sync failed:', e);
      return null;
    }
  },

  // 10. Gemini AI Financial Audit
  async requestAiAudit(params: {
    branch?: string;
    month?: string;
    balances?: EmployeeBalance[];
    transactions?: any[];
    prompt?: string;
  }): Promise<{ success: boolean; analysis?: string; error?: string }> {
    try {
      const res = await fetch('/api/ai/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || 'خطأ في الاتصال بخدمة الذكاء الاصطناعي' };
    }
  },

  // 11. Reconciliation Engine
  async getReconciliation(): Promise<any> {
    try {
      const res = await fetch('/api/reconciliation');
      if (!res.ok) return null;
      const data = await res.json();
      return data.report || data.data || null;
    } catch (e) {
      console.warn('getReconciliation failed:', e);
      return null;
    }
  },

  async reconcileAll(): Promise<any> {
    try {
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'المراقب المالي' })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // 12. Audit Trail Logs
  async getAuditLogs(options?: { entityType?: string; limit?: number }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (options?.entityType) params.append('entityType', options.entityType);
      if (options?.limit) params.append('limit', String(options.limit));

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.logs || data.data || [];
    } catch (e) {
      console.warn('getAuditLogs failed:', e);
      return [];
    }
  },

  // 13. System Health & Diagnostic Test Suite
  async getTestSuiteDiagnostic(): Promise<any> {
    try {
      const res = await fetch('/api/health/test-suite');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }
};
