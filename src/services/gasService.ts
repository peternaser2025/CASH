import { Transaction, ReportFilter, EmployeeBalance, ReportData } from '../types';

// Standard Vite env variable access
const VITE_GAS_URL = (import.meta as any).env.VITE_GAS_URL;
// Fallback to the known URL if the env variable is missing
const GAS_URL = VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbwFEmOuT2zpaXd3eltQLf0GOkllzHjMUQCcYxxiyYpvA0VtCY5L9nZVPm3grJ3x9852iQ/exec';

export const gasService = {
  async getBalances(): Promise<EmployeeBalance[]> {
    if (!GAS_URL || GAS_URL.includes('...')) return [];
    try {
      const response = await fetch(GAS_URL, { 
        method: 'GET',
        redirect: 'follow'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      // Filter out non-employee names
      const ignoreSheets = ['Balances', 'Settings', 'Sheet1', 'الرئيسية', 'عمليات', 'employee', 'البيانات', 'Dashboard', 'Sheet2', 'Sheet3'];
      
      return data
        .filter(([name]: [string, any]) => name && !ignoreSheets.includes(name))
        .map(([name, balance]: [string, number]) => ({ name, balance }));
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
        if (data && data.error) {
          console.error('GAS Error:', data.error);
          return null;
        }
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
  },

  async deleteEmployee(name: string): Promise<{ success: boolean; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'deleteEmployee', name }),
      });
      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      console.error('Error deleting employee:', error);
      return { success: false, error: 'خطأ في الاتصال' };
    }
  },

  async updateTransaction(id: number, transaction: any): Promise<{ success: boolean; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'update', id, data: transaction }),
      });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        return { success: false, error: 'خطأ في معالجة البيانات' };
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      return { success: false, error: 'خطأ في الاتصال' };
    }
  },

  async deleteTransaction(id: number): Promise<{ success: boolean; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        return { success: false, error: 'خطأ في معالجة البيانات' };
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return { success: false, error: 'خطأ في الاتصال' };
    }
  },

  async getSettings(): Promise<{ branches: string[], categories: string[] }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { branches: [], categories: [] };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'getSettings' }),
      });
      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      console.error('Error fetching settings:', error);
      return { branches: [], categories: [] };
    }
  },

  async updateSettings(branches: string[], categories: string[]): Promise<{ success: boolean; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'updateSettings', branches, categories }),
      });
      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      console.error('Error updating settings:', error);
      return { success: false, error: 'خطأ في الاتصال' };
    }
  },

  async addUser(email: string, password: string, displayName: string, role: string = 'admin'): Promise<{ success: boolean; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'addUser', email, password, displayName, role }),
      });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        return { success: false, error: 'خطأ في معالجة البيانات من السيرفر' };
      }
    } catch (error) {
      console.error('Error adding user to GAS:', error);
      return { success: false, error: 'خطأ في الاتصال بالسيرفر' };
    }
  },

  async checkLogin(email: string, password: string): Promise<{ success: boolean; displayName?: string; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      const text = await response.text();
      if (!text || text.trim() === '') {
        return { success: false, error: 'لم يتم تفعيل دالة تسجيل الدخول في سكريبت جوجل شيت بعد' };
      }
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        console.warn('Parsing GAS login response failed, likely action not supported yet:', parseErr);
        return { success: false, error: 'لم يتم تفعيل دالة تسجيل الدخول في سكريبت جوجل شيت بعد' };
      }
    } catch (error) {
      console.error('Error in GAS login:', error);
      return { success: false, error: 'خطأ في الاتصال بالسيرفر' };
    }
  }
};
