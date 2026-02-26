import { Transaction, ReportFilter, EmployeeBalance, ReportData } from '../types';

// Standard Vite env variable access
const VITE_GAS_URL = (import.meta as any).env.VITE_GAS_URL;
// Fallback to the known URL if the env variable is missing
const GAS_URL = VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbzwLl6_FqoVW1j1YbQFqEyopHKvYI1qEY6vu4svLDpd98lpZJOW8E-ldQRQGnnm5W7qPw/exec';

export const gasService = {
  async getBalances(): Promise<EmployeeBalance[]> {
    if (!GAS_URL || GAS_URL.includes('...')) return [];
    try {
      // Use redirect: 'follow' which is crucial for Google Apps Script
      const response = await fetch(GAS_URL, { 
        method: 'GET',
        redirect: 'follow'
      });
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
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'add', data: transaction }),
      });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        return { success: false, error: 'خطأ في معالجة البيانات من السيرفر' };
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      return { success: false, error: 'خطأ في الاتصال. يرجى التأكد من نشر السكريبت بصلاحية "Anyone" وإعادة المحاولة.' };
    }
  },

  async getReport(filters: ReportFilter): Promise<ReportData | null> {
    if (!GAS_URL || GAS_URL.includes('...')) return null;
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'report', filters }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      
      // Check if the response is HTML (often an error page from Google)
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        console.error('Received HTML instead of JSON from GAS:', text.substring(0, 200));
        return null;
      }

      try {
        const data = JSON.parse(text);
        // Ensure rows exists even if empty
        if (data && !data.rows) {
          data.rows = [];
        }
        return data;
      } catch (e) {
        console.error('Failed to parse report JSON:', text);
        return null;
      }
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
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'addEmployee', name }),
      });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        return { success: false, error: 'خطأ في معالجة البيانات' };
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      return { success: false, error: 'خطأ في الاتصال. يرجى التأكد من نشر السكريبت بصلاحية "Anyone".' };
    }
  }
};
