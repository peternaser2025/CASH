import { Transaction, ReportFilter, EmployeeBalance, ReportData } from '../types';

// This URL will be provided by the user after deploying the Google Apps Script as a Web App
const GAS_URL = (import.meta as any).env.VITE_GAS_URL || '';

export const gasService = {
  async getBalances(): Promise<EmployeeBalance[]> {
    if (!GAS_URL) return [];
    try {
      const response = await fetch(GAS_URL);
      const data = await response.json();
      return data.map(([name, balance]: [string, number]) => ({ name, balance }));
    } catch (error) {
      console.error('Error fetching balances:', error);
      return [];
    }
  },

  async addTransaction(transaction: any): Promise<{ success: boolean; id?: number; error?: string }> {
    if (!GAS_URL) return { success: false, error: 'GAS URL not configured' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'add', data: transaction }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error adding transaction:', error);
      return { success: false, error: 'Network error' };
    }
  },

  async getReport(filters: ReportFilter): Promise<ReportData | null> {
    if (!GAS_URL) return null;
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'report', filters }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching report:', error);
      return null;
    }
  },

  async addEmployee(name: string): Promise<{ success: boolean; error?: string }> {
    if (!GAS_URL) return { success: false, error: 'GAS URL not configured' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'addEmployee', name }),
      });
      return await response.json();
    } catch (error) {
      console.error('Error adding employee:', error);
      return { success: false, error: 'Network error' };
    }
  }
};
