import { Transaction, ReportFilter, EmployeeBalance, ReportData } from '../types';

// Standard Vite env variable access
const VITE_GAS_URL = import.meta.env.VITE_GAS_URL;
// Fallback to the known URL if the env variable is missing
const GAS_URL = VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbzwLl6_FqoVW1j1YbQFqEyopHKvYI1qEY6vu4svLDpd98lpZJOW8E-ldQRQGnnm5W7qPw/exec';

export const gasService = {
  async getBalances(): Promise<EmployeeBalance[]> {
    if (!GAS_URL || GAS_URL.includes('...')) return [];
    try {
      const response = await fetch(GAS_URL, { method: 'GET', cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.map(([name, balance]: [string, number]) => ({ name, balance }));
    } catch (error) {
      console.error('Error fetching balances:', error);
      return [];
    }
  },

  async addTransaction(transaction: any): Promise<{ success: boolean; id?: number; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({ action: 'add', data: transaction }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error adding transaction:', error);
      return { success: false, error: 'خطأ في الاتصال بالسيرفر (Network Error). تأكد من نشر السكريبت كـ "Anyone".' };
    }
  },

  async getReport(filters: ReportFilter): Promise<ReportData | null> {
    if (!GAS_URL || GAS_URL.includes('...')) return null;
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({ action: 'report', filters }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching report:', error);
      return null;
    }
  },

  async addEmployee(name: string): Promise<{ success: boolean; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({ action: 'addEmployee', name }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error adding employee:', error);
      return { success: false, error: 'خطأ في الاتصال بالسيرفر (Network Error). يرجى التأكد من أن السكريبت منشور بصلاحية "Anyone".' };
    }
  }
};
