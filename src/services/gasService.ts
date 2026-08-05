import { Transaction, ReportFilter, EmployeeBalance, ReportData } from '../types';

// Standard Vite env variable access
const VITE_GAS_URL = (import.meta as any).env.VITE_GAS_URL;
// Fallback to the known URL if the env variable is missing
const GAS_URL = VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbwFEmOuT2zpaXd3eltQLf0GOkllzHjMUQCcYxxiyYpvA0VtCY5L9nZVPm3grJ3x9852iQ/exec';

// Smart Cache Store
const reportCache: Map<string, { data: ReportData; timestamp: number }> = new Map();
let balancesCache: { data: EmployeeBalance[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 30000; // 30 seconds fresh cache

// Helper to robustly parse responses from Google Apps Script
function safeParseGasResponse(text: string, responseOk: boolean = true): { success: boolean; data?: any; error?: string; [key: string]: any } {
  if (!text || !text.trim()) {
    if (responseOk) {
      return { success: true };
    }
    return { success: false, error: 'استجابة فارغة من السيرفر' };
  }

  const cleaned = text.trim().replace(/^\uFEFF/, '');

  // 1. Direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.success === false) {
        return { success: false, error: parsed.error || 'فشل تنفيذ العملية على شيت جوجل' };
      }
      return { success: true, ...parsed };
    }
    if (typeof parsed === 'boolean') {
      return { success: parsed };
    }
    if (typeof parsed === 'string') {
      try {
        const inner = JSON.parse(parsed);
        if (typeof inner === 'object' && inner !== null) {
          return { success: inner.success !== false, ...inner };
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // Continue
  }

  // 2. Extract JSON object using regex
  const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === 'object' && parsed !== null) {
        if (parsed.success === false) {
          return { success: false, error: parsed.error || 'فشل تنفيذ العملية على شيت جوجل' };
        }
        return { success: true, ...parsed };
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. String keywords match
  if (cleaned.toLowerCase().includes('success') || cleaned.toLowerCase().includes('true') || cleaned === 'OK') {
    return { success: true };
  }

  // 4. HTML error or Exception
  if (cleaned.includes('<html') || cleaned.includes('<!DOCTYPE') || cleaned.includes('Exception:')) {
    const errMsgMatch = cleaned.match(/Exception:\s*([^<]+)/i) || cleaned.match(/<title>([^<]+)<\/title>/i);
    const detail = errMsgMatch ? errMsgMatch[1].trim() : 'حدث خطأ أثناء تنفيذ السكريبت في جوجل شيت';
    return { success: false, error: detail };
  }

  if (responseOk) {
    return { success: true };
  }

  return { success: false, error: 'خطأ في معالجة الاستجابة من السيرفر' };
}

export const gasService = {
  getGasUrl(): string {
    return GAS_URL;
  },

  clearCache() {
    reportCache.clear();
    balancesCache = null;
    try {
      sessionStorage.removeItem('kwd_balances_cache');
      sessionStorage.removeItem('kwd_report_cache');
    } catch (e) {}
  },

  async getBalances(forceRefresh: boolean = false): Promise<EmployeeBalance[]> {
    if (!GAS_URL || GAS_URL.includes('...')) return [];

    const now = Date.now();
    if (!forceRefresh && balancesCache && (now - balancesCache.timestamp < CACHE_TTL_MS)) {
      return balancesCache.data;
    }

    try {
      const response = await fetch(GAS_URL, { 
        method: 'GET',
        redirect: 'follow'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      // Filter out non-employee names
      const ignoreSheets = ['Balances', 'Settings', 'Sheet1', 'الرئيسية', 'عمليات', 'employee', 'البيانات', 'Dashboard', 'Sheet2', 'Sheet3', 'Users'];
      
      const balancesMap = new Map<string, number>();

      if (Array.isArray(data)) {
        data
          .filter(([name]: [string, any]) => name && !ignoreSheets.includes(name))
          .forEach(([name, balance]: [string, number]) => {
            balancesMap.set(String(name).trim(), parseFloat(String(balance)) || 0);
          });
      }

      // Cross-verify with actual report rows to guarantee 100% precision with individual employee sheets
      try {
        const report = await this.getReport({}, forceRefresh);
        if (report && Array.isArray(report.rows) && report.rows.length > 0) {
          const latestEmployeeBalances = new Map<string, number>();
          
          report.rows.forEach((row: any) => {
            const emp = String(row.employee || row[9] || '').trim();
            if (emp && !ignoreSheets.includes(emp)) {
              const bal = parseFloat(String(row.balance !== undefined ? row.balance : (row[7] || 0))) || 0;
              latestEmployeeBalances.set(emp, bal);
            }
          });

          latestEmployeeBalances.forEach((val, emp) => {
            balancesMap.set(emp, val);
          });
        }
      } catch (e) {
        console.warn('Could not cross-verify balances with report rows:', e);
      }

      const parsedBalances: EmployeeBalance[] = Array.from(balancesMap.entries()).map(([name, balance]) => ({
        name,
        balance
      }));

      balancesCache = { data: parsedBalances, timestamp: now };
      return parsedBalances;
    } catch (error) {
      console.error('Error fetching balances:', error);
      return balancesCache ? balancesCache.data : [];
    }
  },

  async addTransaction(transaction: any): Promise<{ success: boolean; id?: number; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'add', data: transaction }),
      });
      const text = await response.text();
      this.clearCache(); // Invalidate cache on write
      return safeParseGasResponse(text, response.ok);
    } catch (error) {
      console.error('Error adding transaction:', error);
      return { success: false, error: 'خطأ في الاتصال. يرجى التأكد من نشر السكريبت بصلاحية "Anyone" وإعادة المحاولة.' };
    }
  },

  async getReport(filters: ReportFilter, forceRefresh: boolean = false): Promise<ReportData | null> {
    if (!GAS_URL || GAS_URL.includes('...')) return null;

    const cacheKey = JSON.stringify(filters);
    const now = Date.now();

    if (!forceRefresh && reportCache.has(cacheKey)) {
      const cached = reportCache.get(cacheKey)!;
      if (now - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    }

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
      
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        console.error('Received HTML instead of JSON from GAS:', text.substring(0, 200));
        return reportCache.has(cacheKey) ? reportCache.get(cacheKey)!.data : null;
      }

      try {
        const data = JSON.parse(text);
        if (data && data.error) {
          console.error('GAS Error:', data.error);
          return null;
        }
        if (data && !data.rows) {
          data.rows = [];
        }

        reportCache.set(cacheKey, { data, timestamp: now });
        return data;
      } catch (e) {
        console.error('Failed to parse report JSON:', text);
        return reportCache.has(cacheKey) ? reportCache.get(cacheKey)!.data : null;
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      return reportCache.has(cacheKey) ? reportCache.get(cacheKey)!.data : null;
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

  async updateTransaction(id: number | string, transaction: any): Promise<{ success: boolean; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const targetId = transaction.id || transaction.rowId || transaction.rowIndex || id;
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ 
          action: 'update', 
          id: targetId, 
          rowId: targetId, 
          rowIndex: transaction.rowIndex || targetId, 
          data: { 
            ...transaction, 
            id: targetId, 
            rowId: targetId, 
            rowIndex: transaction.rowIndex || targetId 
          } 
        }),
      });
      const text = await response.text();
      this.clearCache();
      return safeParseGasResponse(text, response.ok);
    } catch (error) {
      console.error('Error updating transaction:', error);
      return { success: false, error: 'خطأ في الاتصال بالسيرفر' };
    }
  },

  async deleteTransaction(id: number | string, extraMeta?: any): Promise<{ success: boolean; error?: string }> {
    if (!GAS_URL || GAS_URL.includes('...')) return { success: false, error: 'رابط Google Apps Script غير مهيأ بشكل صحيح' };
    try {
      const targetId = extraMeta?.id || extraMeta?.rowId || extraMeta?.rowIndex || id;
      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ 
          action: 'delete', 
          id: targetId, 
          rowId: targetId, 
          rowIndex: extraMeta?.rowIndex || targetId, 
          ...extraMeta 
        }),
      });
      const text = await response.text();
      this.clearCache();
      return safeParseGasResponse(text, response.ok);
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
