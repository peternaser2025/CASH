import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  Scale,
  FileSpreadsheet,
  FileText,
  FileDown,
  Printer,
  Save,
  Plus,
  RefreshCw,
  Search,
  PenSquare,
  Trash2,
  Check,
  Ban,
  Building,
  ChevronDown,
  ChevronUp,
  Boxes,
  Calculator,
  ArrowRightLeft,
  ListChecks,
  Tags,
  Wallet,
  X,
  Calendar,
  AlertCircle,
  Eye,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Sparkles,
  Coins
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { apiService } from '../services/apiService';
import { EmployeeBalance } from '../types';
import { parseReportRow } from '../utils/format';

interface ProfitLossProps {
  branches: string[];
  categories?: string[];
  balances?: EmployeeBalance[];
  onRefresh?: () => void;
}

export interface PLTransaction {
  _uid: number;
  ID: string | number;
  Date: Date | null;
  DateStr: string;
  Employee: string;
  Branch: string;
  Type: 'Income' | 'Expense' | 'Transfer-In' | 'Transfer-Out' | string;
  Category: string;
  Amount: number;
  Description: string;
  Related_ID?: string | number;
  isExcluded: number; // 1 = excluded from P&L, 0 = included
}

export interface AccrualItem {
  id: number;
  type: 'رواتب' | 'إيجار' | 'أخرى';
  employee: string;
  branch: string;
  amount: number;
  description: string;
}

export interface ReportHeaderConfig {
  company: string;
  subtitle: string;
  address: string;
  phone: string;
  email: string;
  license: string;
  note: string;
}

interface FundSummary {
  name: string;
  opening: number;
  receipts: number;
  payments: number;
  tin: number;
  tout: number;
  closing: number;
  count: number;
  lines: PLTransaction[];
}

const MONTH_AR = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const COGS_CATS = new Set(['مشتريات', 'مشتريات (آجل/مستحق)', 'تكلفة البضاعة المباعة', 'بضاعة']);

function normalizeType(raw: any): 'Income' | 'Expense' | 'Transfer-In' | 'Transfer-Out' {
  const t = String(raw || '').trim();
  if (/^transfer-in$/i.test(t) || /تحويل\s*وارد/.test(t) || t === 'وارد') return 'Transfer-In';
  if (/^transfer-out$/i.test(t) || /تحويل\s*صادر/.test(t) || t === 'صادر') return 'Transfer-Out';
  if (/^expense$/i.test(t) || t === 'مصروف' || t === 'مدفوع' || t === 'صادر / مدفوعات') return 'Expense';
  if (/^income$/i.test(t) || t === 'إيراد' || t === 'ايراد' || t === 'مقبوضات' || t === 'مقبوض' || t === 'وارد / مقبوضات' || t === 'مبيعات') return 'Income';
  if (/transfer/i.test(t) || t === 'تحويل') return 'Transfer-Out';
  return 'Expense';
}

function pickAmount(r: any): number {
  for (const k of Object.keys(r)) {
    if (/مبلغ|amount|expense|income|قيمة/i.test(k) && r[k] !== '' && r[k] != null) {
      const n = parseFloat(String(r[k]).replace(/,/g, ''));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return parseFloat(r.Amount || 0) || 0;
}

function pickDate(r: any): Date | null {
  const raw = r.Date || r['التاريخ'] || r['تاريخ'] || '';
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if (typeof raw === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const dt = new Date(epoch.getTime() + raw * 86400000);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(raw);
  return isNaN(dt.getTime()) ? null : dt;
}

function isoDate(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function esc(s: any): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function ProfitLoss({ branches: propBranches = [], categories = [], balances = [], onRefresh }: ProfitLossProps) {
  // Master transactions data
  const [allData, setAllData] = useState<PLTransaction[]>([]);
  const [employeeOpeningBalances, setEmployeeOpeningBalances] = useState<Record<string, number>>({});
  
  // Period and filter selections
  const [selYear, setSelYear] = useState<number>(() => new Date().getFullYear());
  const [selMonth, setSelMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selBranch, setSelBranch] = useState<string>('ALL');
  const [selCurrency, setSelCurrency] = useState<string>('د.ك');

  // Inventory & Accruals
  const [invOpening, setInvOpening] = useState<number>(0);
  const [invClosing, setInvClosing] = useState<number>(0);
  const [accrualLines, setAccrualLines] = useState<AccrualItem[]>([]);
  const [nextAccId, setNextAccId] = useState<number>(1);

  // New accrual input state
  const [newAccType, setNewAccType] = useState<'رواتب' | 'إيجار' | 'أخرى'>('رواتب');
  const [newAccEmp, setNewAccEmp] = useState<string>('');
  const [newAccBranch, setNewAccBranch] = useState<string>('');
  const [newAccAmt, setNewAccAmt] = useState<string>('');
  const [newAccDesc, setNewAccDesc] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'pnl' | 'sales' | 'inv' | 'trans' | 'audit' | 'classify' | 'funds'>('pnl');

  // Header Config & Accordion
  const [isHeaderOpen, setIsHeaderOpen] = useState<boolean>(false);
  const [headerConfig, setHeaderConfig] = useState<ReportHeaderConfig>({
    company: '',
    subtitle: '',
    address: '',
    phone: '',
    email: '',
    license: '',
    note: ''
  });

  // Reclassification state
  const [clsFrom, setClsFrom] = useState<string>('');
  const [clsTo, setClsTo] = useState<string>('');
  const [clsNew, setClsNew] = useState<string>('');

  // Funds tab state
  const [fundSelect, setFundSelect] = useState<string>('ALL');
  const [fundGroupBy, setFundGroupBy] = useState<'employee' | 'branch' | 'emp_branch'>('employee');

  // Audit Search
  const [auditSearch, setAuditSearch] = useState<string>('');

  // UI helpers
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick direct sales entry state (Persisted in server, sheet, & DB)
  const [quickSaleDate, setQuickSaleDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [quickSaleBranch, setQuickSaleBranch] = useState<string>('');
  const [quickSaleEmployee, setQuickSaleEmployee] = useState<string>('');
  const [quickSaleCategory, setQuickSaleCategory] = useState<string>('مبيعات');
  const [quickSaleAmount, setQuickSaleAmount] = useState<string>('');
  const [quickSaleDesc, setQuickSaleDesc] = useState<string>('');
  const [quickSaleSubmitting, setQuickSaleSubmitting] = useState<boolean>(false);
  const [savingRow, setSavingRow] = useState<boolean>(false);

  // Modals state
  const [editModalData, setEditModalData] = useState<{
    isOpen: boolean;
    idx: number;
    targetUid?: number;
    targetId?: string | number;
    DateStr: string;
    Branch: string;
    Employee: string;
    Type: string;
    Category: string;
    Amount: number | string;
    isExcluded: number;
    Description: string;
  } | null>(null);

  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    key: string;
    label: string;
  } | null>(null);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => (prev === msg ? null : prev));
    }, 3200);
  };

  const periodKey = useMemo(() => {
    return `${selYear}-${String(selMonth).padStart(2, '0')}`;
  }, [selYear, selMonth]);

  // Load balances from prop on mount
  useEffect(() => {
    if (balances && balances.length > 0) {
      const bMap: Record<string, number> = {};
      balances.forEach(b => {
        if (b.name) bMap[b.name.trim()] = b.balance;
      });
      setEmployeeOpeningBalances(prev => ({ ...prev, ...bMap }));
    }
  }, [balances]);

  // Restore saved session from localStorage on mount
  useEffect(() => {
    try {
      const hRaw = localStorage.getItem('pl_header_v1');
      if (hRaw) {
        setHeaderConfig(JSON.parse(hRaw));
      }
      const saved = localStorage.getItem('pl_audit_v2');
      if (saved) {
        const obj = JSON.parse(saved);
        if (Array.isArray(obj.data) && obj.data.length > 0) {
          const parsed = obj.data.map((r: any) => ({
            ...r,
            Date: r.DateStr ? new Date(r.DateStr + 'T12:00:00') : (r.Date ? new Date(r.Date) : null)
          }));
          setAllData(parsed);
        }
        if (obj.inv) {
          setInvOpening(parseFloat(obj.inv.op) || 0);
          setInvClosing(parseFloat(obj.inv.cl) || 0);
        }
        if (Array.isArray(obj.accruals)) {
          setAccrualLines(obj.accruals);
          setNextAccId(obj.accruals.reduce((m: number, r: AccrualItem) => Math.max(m, r.id || 0), 0) + 1);
        }
      }
    } catch (e) {
      console.error('Failed to restore P&L state:', e);
    }
  }, []);

  // Fetch live backend data if allData is empty
  useEffect(() => {
    if (allData.length === 0) {
      loadLiveData();
    }
  }, []);

  // When periodKey changes, restore period extras if saved
  useEffect(() => {
    try {
      const pRaw = localStorage.getItem('pl_period_' + periodKey);
      if (pRaw) {
        const pObj = JSON.parse(pRaw);
        if (pObj.inv) {
          setInvOpening(parseFloat(pObj.inv.op) || 0);
          setInvClosing(parseFloat(pObj.inv.cl) || 0);
        }
        if (Array.isArray(pObj.accruals)) {
          setAccrualLines(pObj.accruals);
          setNextAccId(pObj.accruals.reduce((m: number, r: AccrualItem) => Math.max(m, r.id || 0), 0) + 1);
        }
      }
    } catch (_) {}
  }, [periodKey]);

  const loadLiveData = async () => {
    setLoadingMsg('جاري جلب كافة المعاملات من Google Sheets...');
    try {
      const res = await gasService.getReport({ startDate: '', endDate: '' });
      if (res && Array.isArray(res.rows)) {
        const mapped: PLTransaction[] = res.rows.map((rowArr: any[], idx: number) => {
          const parsed = parseReportRow(rowArr);
          const rawType = parsed.type || (parsed.income > 0 ? 'Income' : 'Expense');
          const type = normalizeType(rawType);
          const cat = parsed.category || '';
          const isTrans = type === 'Transfer-In' || type === 'Transfer-Out' ||
            /transfer/i.test(String(rawType)) || /transfer|تسوية/i.test(cat);
          const dateObj = parsed.date ? new Date(parsed.date + 'T12:00:00') : null;
          const amt = parsed.income > 0 ? parsed.income : parsed.expense;
          return {
            _uid: idx + 1,
            ID: (rowArr[12] && !isNaN(Number(rowArr[12]))) ? Number(rowArr[12]) : (idx + 1),
            Date: dateObj,
            DateStr: parsed.date || '',
            Employee: parsed.employee || '',
            Branch: parsed.branch || '',
            Type: type,
            Category: cat || (isTrans ? 'تحويل' : ''),
            Amount: amt,
            Description: parsed.description || '',
            Related_ID: rowArr[13] || '',
            isExcluded: isTrans ? 1 : 0
          };
        }).filter(r => r.Type || r.Category || r.Amount);

        if (mapped.length > 0) {
          setAllData(prev => {
            const mappedIds = new Set(mapped.map(m => String(m.ID || m._uid)));
            const localOnly = prev.filter(r => r.ID && !mappedIds.has(String(r.ID)) && !mappedIds.has(String(r._uid)));
            return [...localOnly, ...mapped];
          });
          toast(`تم تحميل ${mapped.length.toLocaleString('ar-KW')} حركة من قاعدة البيانات`);
          const latest = mapped.filter(r => r.Date).sort((a, b) => (b.Date?.getTime() || 0) - (a.Date?.getTime() || 0))[0];
          if (latest && latest.Date) {
            setSelYear(latest.Date.getFullYear());
            setSelMonth(latest.Date.getMonth() + 1);
          }
        }
      }
    } catch (e: any) {
      console.error('Error fetching live P&L data:', e);
      toast('تعذر جلب البيانات السحابية: ' + (e.message || ''));
    } finally {
      setLoadingMsg(null);
    }
  };

  // Upload Excel file handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingMsg('قراءة ملف Excel وتحليل الحركات...');
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: 'array', cellDates: true });
        
        // Load opening balances if exists
        const bMap: Record<string, number> = {};
        const empSheetName = wb.SheetNames.find(n => /emp|موظف|عهد|رصيد/i.test(n));
        if (empSheetName) {
          const empRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[empSheetName], { defval: '' });
          empRows.forEach(r => {
            const emp = String(r.Name || r.Employee || r['الموظف'] || r['الاسم'] || r['اسم'] || '').trim();
            if (!emp) return;
            let bal = 0;
            for (const k of Object.keys(r)) {
              if (/balance|رصيد|عهدة|افتتاح/i.test(k)) {
                const v = parseFloat(String(r[k]).replace(/,/g, ''));
                if (!isNaN(v)) { bal = v; break; }
              }
            }
            if (!bal && r.Balance != null) bal = parseFloat(r.Balance) || 0;
            bMap[emp] = bal;
          });
          setEmployeeOpeningBalances(prev => ({ ...prev, ...bMap }));
        }

        // Transactions sheet
        let transSheetName = wb.SheetNames.find(n => /trans|حرك|قيود|تفاصيل/i.test(n)) || wb.SheetNames[0];
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[transSheetName], { defval: '' });

        const mapped: PLTransaction[] = rows.map((r, i) => {
          const typeRaw = r.Type || r['النوع'] || r['نوع الحركة'] || r['نوع_الحركة'] || '';
          const type = normalizeType(typeRaw);
          const cat = String(r.Category || r['التصنيف'] || r['الفئة'] || '').trim();
          const isTrans = type === 'Transfer-In' || type === 'Transfer-Out' ||
            /transfer/i.test(String(typeRaw)) || /transfer|تسوية/i.test(cat);
          const dateObj = pickDate(r);
          return {
            _uid: i + 1,
            ID: r.ID || r['رقم القيد الأصلي'] || r['م'] || (i + 1),
            Date: dateObj,
            DateStr: dateObj ? isoDate(dateObj) : '',
            Employee: String(r.Employee || r['الموظف'] || '').trim(),
            Branch: String(r.Branch || r['الفرع'] || '').trim(),
            Type: type,
            Category: cat || (isTrans ? 'Transfer' : ''),
            Amount: pickAmount(r),
            Description: String(r.Description || r['الوصف'] || r['البيان'] || '').trim(),
            Related_ID: r.Related_ID || r['رقم الربط'] || '',
            isExcluded: isTrans ? 1 : 0
          };
        }).filter(r => r.Type || r.Category || r.Amount);

        setAllData(mapped);
        toast(`تم تحميل ${mapped.length.toLocaleString('ar-KW')} حركة بنجاح من ورقة (${transSheetName})`);
        const latest = mapped.filter(r => r.Date).sort((a, b) => (b.Date?.getTime() || 0) - (a.Date?.getTime() || 0))[0];
        if (latest && latest.Date) {
          setSelYear(latest.Date.getFullYear());
          setSelMonth(latest.Date.getMonth() + 1);
        }
      } catch (err: any) {
        console.error(err);
        toast('خطأ أثناء قراءة ملف الإكسيل: ' + err.message);
      } finally {
        setLoadingMsg(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Available unique years & branches from data
  const availableYears = useMemo(() => {
    const setY = new Set<number>();
    allData.forEach(r => {
      if (r.Date) setY.add(r.Date.getFullYear());
    });
    const arr = Array.from(setY).sort((a, b) => b - a);
    return arr.length > 0 ? arr : [2026, 2025];
  }, [allData]);

  const availableBranches = useMemo(() => {
    const setB = new Set<string>();
    propBranches.forEach(b => b && setB.add(b.trim()));
    allData.forEach(r => r.Branch && setB.add(r.Branch.trim()));
    return Array.from(setB).sort();
  }, [allData, propBranches]);

  const availableCategories = useMemo(() => {
    const setC = new Set<string>();
    categories.forEach(c => c && setC.add(c.trim()));
    allData.forEach(r => r.Category && setC.add(r.Category.trim()));
    return Array.from(setC).sort();
  }, [allData, categories]);

  const availableEmployees = useMemo(() => {
    const setE = new Set<string>();
    balances.forEach(b => b.name && setE.add(b.name.trim()));
    allData.forEach(r => r.Employee && setE.add(r.Employee.trim()));
    const arr = Array.from(setE).sort();
    return arr.length > 0 ? arr : ['كاشير الفرع الرئيسي', 'بيتر ناصر', 'محمد جابر', 'مسؤول المبيعات'];
  }, [allData, balances]);

  // Filtered dataset for selected Month & Year
  const monthData = useMemo(() => {
    return allData.filter(r => {
      if (!r.Date) return false;
      return r.Date.getFullYear() === selYear && (r.Date.getMonth() + 1) === selMonth;
    });
  }, [allData, selYear, selMonth]);

  // Filtered dataset for selected Branch (ViewData)
  const viewData = useMemo(() => {
    if (selBranch === 'ALL') return monthData;
    return monthData.filter(r => (r.Branch || '').trim() === selBranch.trim());
  }, [monthData, selBranch]);

  // Financial Stats Calculation (P&L calculations)
  const stats = useMemo(() => {
    let income = 0;
    let purchases = 0;
    let opex = 0;
    const byCat: Record<string, number> = {};

    viewData.forEach(r => {
      if (r.isExcluded === 1) return;
      const amt = r.Amount || 0;
      if (r.Type === 'Income') {
        income += amt;
      } else if (r.Type === 'Expense') {
        if (COGS_CATS.has(r.Category)) {
          purchases += amt;
        } else {
          opex += amt;
          const cName = r.Category || 'مصروفات أخرى';
          byCat[cName] = (byCat[cName] || 0) + amt;
        }
      }
    });

    const accS = accrualLines.filter(a => a.type === 'رواتب').reduce((s, a) => s + (a.amount || 0), 0);
    const accR = accrualLines.filter(a => a.type === 'إيجار').reduce((s, a) => s + (a.amount || 0), 0);
    const accO = accrualLines.filter(a => a.type === 'أخرى').reduce((s, a) => s + (a.amount || 0), 0);
    const accrued = accS + accR + accO;

    const cogs = invOpening + purchases - invClosing;
    const gross = income - cogs;
    const totalExp = cogs + opex + accrued;
    const net = income - totalExp;

    return {
      income,
      purchases,
      opex,
      byCat,
      op: invOpening,
      cl: invClosing,
      accrued,
      accS,
      accR,
      accO,
      cogs,
      gross,
      totalExp,
      net
    };
  }, [viewData, invOpening, invClosing, accrualLines]);

  const fmt = (n: number | string | undefined | null) => {
    const v = Number(n) || 0;
    return v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const fmtC = (n: number | string | undefined | null) => {
    const s = fmt(n);
    return selCurrency ? `${s} ${selCurrency}` : s;
  };

  const pct = (part: number, whole: number) => {
    if (!whole || whole === 0) return '—';
    return ((part / whole) * 100).toFixed(1) + '%';
  };

  // Save current month state to localStorage & Server Store
  const saveCurrentMonthState = (showToast: boolean = true, customData?: PLTransaction[]) => {
    try {
      const dataToSave = customData || allData;
      const payload = {
        data: dataToSave,
        inv: { op: invOpening, cl: invClosing },
        accruals: accrualLines,
        header: headerConfig,
        period: periodKey,
        branch: selBranch,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('pl_audit_v2', JSON.stringify(payload));
      localStorage.setItem('pl_period_' + periodKey, JSON.stringify({
        inv: payload.inv,
        accruals: payload.accruals,
        branch: payload.branch,
        savedAt: payload.savedAt
      }));
      localStorage.setItem('pl_header_v1', JSON.stringify(headerConfig));

      // Asynchronously backup and sync to server filesystem store
      try {
        apiService.syncAll({
          transactions: dataToSave.map(r => ({
            id: r.ID || r._uid,
            rowId: r.ID || r._uid,
            date: r.DateStr,
            employee: r.Employee,
            branch: r.Branch,
            type: r.Type,
            category: r.Category,
            amount: r.Amount,
            description: r.Description,
            isExcluded: r.isExcluded,
            targetMonth: periodKey
          }))
        }).catch(() => {});
      } catch (e) {}

      if (showToast) toast(`تم حفظ وتحديث بيانات شهر ${periodKey} بنجاح`);
    } catch (e: any) {
      toast('فشل الحفظ: ' + (e.message || ''));
    }
  };

  // Header management
  const handleSaveHeader = () => {
    localStorage.setItem('pl_header_v1', JSON.stringify(headerConfig));
    toast('تم حفظ ترويسة التقرير المعتمدة');
  };

  const handleClearHeader = () => {
    setHeaderConfig({
      company: '',
      subtitle: '',
      address: '',
      phone: '',
      email: '',
      license: '',
      note: ''
    });
    localStorage.removeItem('pl_header_v1');
    toast('تم مسح حقول الترويسة');
  };

  // Accruals handlers
  const handleAddAccrual = () => {
    const amt = parseFloat(newAccAmt);
    if (isNaN(amt) || amt <= 0) {
      toast('يرجى إدخال مبلغ صحيح للبند المستحق');
      return;
    }
    const newItem: AccrualItem = {
      id: nextAccId,
      type: newAccType,
      employee: newAccEmp.trim(),
      branch: newAccBranch.trim() || (selBranch === 'ALL' ? '' : selBranch),
      amount: amt,
      description: newAccDesc.trim() || `${newAccType} مستحق ${newAccEmp ? '— ' + newAccEmp : ''}`
    };
    setNextAccId(prev => prev + 1);
    setAccrualLines(prev => [...prev, newItem]);
    setNewAccAmt('');
    setNewAccDesc('');
    setNewAccEmp('');
    toast('تمت إضافة البند المستحق بنجاح');
  };

  const handleDeleteAccrual = (id: number) => {
    setAccrualLines(prev => prev.filter(a => a.id !== id));
    toast('تم حذف البند المستحق');
  };

  // Reclassification handler
  const handleApplyClassify = () => {
    let from = clsFrom.trim();
    let to = clsTo.trim();
    if (to === '__new__' || clsNew.trim()) {
      if (!clsNew.trim()) {
        toast('يرجى كتابة اسم التصنيف الجديد');
        return;
      }
      to = clsNew.trim();
    }
    if (!from || !to || from === to) {
      toast('يرجى تحديد تصنيفين مختلفين');
      return;
    }
    let count = 0;
    setAllData(prev => prev.map(r => {
      // Apply only to active period & branch
      const inPeriod = r.Date && r.Date.getFullYear() === selYear && (r.Date.getMonth() + 1) === selMonth;
      const inBranch = selBranch === 'ALL' || (r.Branch || '').trim() === selBranch.trim();
      if (inPeriod && inBranch && r.Category === from) {
        count++;
        return { ...r, Category: to };
      }
      return r;
    }));
    toast(`تمت إعادة تصنيف ${count} حركة بنجاح إلى "${to}"`);
    setClsNew('');
  };

  // Drilldown items getter
  const getDetailRows = (key: string): PLTransaction[] => {
    const included = viewData.filter(r => r.isExcluded === 0);
    if (key === 'income') return included.filter(r => r.Type === 'Income');
    if (key === 'purchases') return included.filter(r => r.Type === 'Expense' && COGS_CATS.has(r.Category));
    if (key === 'opex') return included.filter(r => r.Type === 'Expense' && !COGS_CATS.has(r.Category));
    if (key.startsWith('cat:')) {
      const cat = key.slice(4);
      return included.filter(r => r.Type === 'Expense' && r.Category === cat);
    }
    if (key === 'accrued' || key.startsWith('accrued:')) {
      let lines = accrualLines;
      if (key.startsWith('accrued:') && key !== 'accrued:') {
        const t = key.slice(8);
        lines = accrualLines.filter(a => a.type === t);
      }
      return lines.map(a => ({
        _uid: -a.id,
        ID: `مستحق-${a.id}`,
        Date: null,
        DateStr: '—',
        Employee: a.employee || '—',
        Branch: a.branch || '—',
        Type: 'مستحق',
        Category: a.type,
        Amount: a.amount || 0,
        Description: a.description || `${a.type} مستحق`,
        isExcluded: 0
      }));
    }
    return [];
  };

  // Funds calculation & Ledgers
  const periodBounds = useMemo(() => {
    const start = new Date(selYear, selMonth - 1, 1, 0, 0, 0, 0);
    const end = new Date(selYear, selMonth, 0, 23, 59, 59, 999);
    return { start, end };
  }, [selYear, selMonth]);

  const fundGroupKey = (r: PLTransaction): string => {
    const emp = (r.Employee || '').trim() || 'بدون اسم';
    const br = (r.Branch || '').trim() || 'غير محدد';
    if (fundGroupBy === 'branch') return br;
    if (fundGroupBy === 'emp_branch') return `${emp} — ${br}`;
    return emp;
  };

  const fundMoveDelta = (r: PLTransaction): number => {
    const amt = r.Amount || 0;
    if (r.Type === 'Income' || r.Type === 'Transfer-In') return amt;
    if (r.Type === 'Expense' || r.Type === 'Transfer-Out') return -amt;
    return -amt;
  };

  const fundAllLines = (selName: string): PLTransaction[] => {
    return allData.filter(r => {
      if (!r.Date) return false;
      if (selName === 'ALL') return true;
      const emp = (r.Employee || '').trim() || 'بدون اسم';
      const br = (r.Branch || '').trim() || 'غير محدد';
      if (fundGroupBy === 'branch') return br === selName;
      if (fundGroupBy === 'emp_branch') return `${emp} — ${br}` === selName;
      return emp === selName;
    });
  };

  const getEmployeeOpeningBalance = (empName: string): number => {
    const { start } = periodBounds;
    let base = 0;
    if (fundGroupBy === 'employee' || fundGroupBy === 'emp_branch') {
      const empOnly = (empName || '').split(' — ')[0].trim();
      if (employeeOpeningBalances[empOnly] != null) base = employeeOpeningBalances[empOnly];
      else if (employeeOpeningBalances[empName] != null) base = employeeOpeningBalances[empName];
      else {
        const key = Object.keys(employeeOpeningBalances).find(k => k.includes(empOnly) || empOnly.includes(k));
        if (key) base = employeeOpeningBalances[key];
      }
    }
    // Add all net movements before the start of the period
    const priorLines = fundAllLines(empName).filter(r => r.Date && r.Date < start);
    priorLines.forEach(r => { base += fundMoveDelta(r); });
    return base;
  };

  const fundsMap = useMemo<Record<string, FundSummary>>(() => {
    const map: Record<string, FundSummary> = {};
    const ensure = (name: string): FundSummary => {
      const k = (name || '').trim() || 'بدون اسم';
      if (!map[k]) {
        map[k] = {
          name: k,
          opening: 0,
          receipts: 0,
          payments: 0,
          tin: 0,
          tout: 0,
          closing: 0,
          count: 0,
          lines: []
        };
      }
      return map[k];
    };

    viewData.forEach(r => {
      const f = ensure(fundGroupKey(r));
      const amt = r.Amount || 0;
      const isTransfer = r.Type === 'Transfer-In' || r.Type === 'Transfer-Out' || r.Category === 'Transfer';
      f.count++;
      f.lines.push(r);

      if (isTransfer) {
        if (r.Type === 'Transfer-In') f.tin += amt;
        else if (r.Type === 'Transfer-Out') f.tout += amt;
        return;
      }
      if (r.isExcluded === 1) return;
      if (r.Type === 'Income') f.receipts += amt;
      else if (r.Type === 'Expense') f.payments += amt;
    });

    Object.values(map).forEach(f => {
      f.opening = getEmployeeOpeningBalance(f.name);
      f.closing = f.opening + f.receipts + f.tin - f.payments - f.tout;
    });

    return map;
  }, [viewData, fundGroupBy, employeeOpeningBalances, selYear, selMonth]);

  const fundsList = useMemo<FundSummary[]>(() => {
    return (Object.values(fundsMap) as FundSummary[]).sort((a: FundSummary, b: FundSummary) =>
      (b.receipts + b.payments + b.tin + b.tout) - (a.receipts + a.payments + a.tin + a.tout)
    );
  }, [fundsMap]);

  // Fund ledger lines for current selected fund
  const currentFundLedger = useMemo(() => {
    const { start, end } = periodBounds;
    let allLines = fundAllLines(fundSelect);
    allLines.sort((a, b) => ((a.Date?.getTime() || 0) - (b.Date?.getTime() || 0)) || (Number(a.ID || 0) - Number(b.ID || 0)));

    const prior = allLines.filter(r => r.Date && r.Date < start);
    const periodRows = allLines.filter(r => r.Date && r.Date >= start && r.Date <= end);

    let opening = 0;
    if (fundSelect === 'ALL') {
      const seen = new Set<string>();
      allData.forEach(r => {
        const emp = (r.Employee || '').trim();
        if (emp && !seen.has(emp)) {
          seen.add(emp);
          if (employeeOpeningBalances[emp] != null) opening += employeeOpeningBalances[emp];
        }
      });
      prior.forEach(r => { opening += fundMoveDelta(r); });
    } else {
      opening = getEmployeeOpeningBalance(fundSelect);
    }

    return { prior, periodRows, opening };
  }, [fundSelect, allData, fundGroupBy, employeeOpeningBalances, selYear, selMonth]);

  // Print Fund Ledger (Exact landscape accounting statement format with wide description and signatures)
  const handlePrintFundLedger = () => {
    const { prior, periodRows, opening } = currentFundLedger;
    const { start, end } = periodBounds;
    const monthName = `${MONTH_AR[selMonth]} ${selYear}`;
    const who = fundSelect === 'ALL' ? 'جميع الصناديق' : fundSelect;

    let bal = opening;
    let sumOut = 0, sumIn = 0;
    let sumExclOut = 0, sumExclIn = 0, sumInclOut = 0, sumInclIn = 0;

    let rowsHtml = '';
    rowsHtml += `
      <tr class="open">
        <td class="c">—</td>
        <td class="dt">${start.toLocaleDateString('en-CA')}</td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num bal">${fmt(opening)}</td>
        <td class="desc">الرصيد الافتتاحي المرحل من السجلات السابقة لما قبل ${monthName}</td>
        <td class="br"></td>
      </tr>
    `;

    periodRows.forEach((r, i) => {
      const amt = r.Amount || 0;
      const isIn = r.Type === 'Income' || r.Type === 'Transfer-In';
      const isOut = r.Type === 'Expense' || r.Type === 'Transfer-Out';
      let outV = '', inV = '';
      if (isOut) { outV = fmt(amt); bal -= amt; sumOut += amt; }
      else if (isIn) { inV = fmt(amt); bal += amt; sumIn += amt; }
      else { outV = fmt(amt); bal -= amt; sumOut += amt; }

      const isT = r.Type === 'Transfer-In' || r.Type === 'Transfer-Out';
      const excluded = isT || r.isExcluded === 1;
      if (excluded) {
        if (isOut) sumExclOut += amt; else if (isIn) sumExclIn += amt;
      } else {
        if (isOut) sumInclOut += amt; else if (isIn) sumInclIn += amt;
      }

      let desc = (r.Description || '').trim() || '—';
      if (excluded) desc += '  [مستبعد من P&L]';

      rowsHtml += `
        <tr ${excluded ? 'class="excl"' : ''}>
          <td class="c">${i + 1}</td>
          <td class="dt">${r.DateStr || ''}</td>
          <td class="num">${outV}</td>
          <td class="num">${inV}</td>
          <td class="num bal">${fmt(bal)}</td>
          <td class="desc">${esc(desc)}</td>
          <td class="br">${esc(r.Branch || '')}</td>
        </tr>
      `;
    });

    const notes = [
      `الرصيد الافتتاحي: ${fmt(opening)} ${selCurrency} (رصيد مسجل + ${prior.length} حركة سابقة لما قبل ${monthName}).`,
      `إجمالي الصادر: ${fmt(sumOut)} | إجمالي الوارد: ${fmt(sumIn)} | الرصيد الختامي: ${fmt(bal)} ${selCurrency}.`,
      `محتسب في الأرباح والخسائر — صادر: ${fmt(sumInclOut)} | وارد: ${fmt(sumInclIn)}.`,
      `مستبعد (تحويلات عهد وتسويات) — صادر: ${fmt(sumExclOut)} | وارد: ${fmt(sumExclIn)}.`,
      `حركات الفترة المعتمدة: ${periodRows.length} حركة | حركات سابقة مفصلة: ${prior.length} حركة.`
    ];

    const company = esc(headerConfig.company || 'نظام التدقيق المالي المعتمد');
    const subtitle = esc(headerConfig.subtitle || '');
    const address = esc(headerConfig.address || '');
    const contact = [headerConfig.phone, headerConfig.email, headerConfig.license, headerConfig.note].filter(Boolean).map(esc).join(' | ');
    const printDate = new Date().toLocaleDateString('ar-KW');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>كشف حساب — ${esc(who)} — ${monthName}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 12mm 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'IBM Plex Sans Arabic', Tahoma, "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    color: #000;
    margin: 0;
    padding: 10px 12px 16px;
    line-height: 1.4;
    background: #fff;
  }
  .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { margin: 0 0 4px; font-size: 15pt; font-weight: bold; }
  .header .info { font-size: 10.5pt; color: #222; line-height: 1.5; }
  table.ledger { width: 100%; border-collapse: collapse; font-size: 10pt; table-layout: fixed; }
  table.ledger thead { display: table-header-group; }
  table.ledger th {
    background: #0f172a;
    color: #fff;
    border: 1px solid #000;
    padding: 7px 6px;
    font-size: 10pt;
    font-weight: bold;
    text-align: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table.ledger td { border: 1px solid #777; padding: 6px 8px; vertical-align: middle; }
  table.ledger tr.open td { background: #f1f5f9; font-weight: bold; }
  table.ledger tr.excl td { background: #fafafa; }
  .c { width: 4%; text-align: center; }
  .dt { width: 10%; text-align: center; white-space: nowrap; }
  .num { width: 11%; text-align: right; direction: ltr; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bal { width: 11%; font-weight: bold; text-align: right; direction: ltr; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .desc { width: 44%; text-align: right; font-size: 10pt; font-weight: 700; word-wrap: break-word; overflow-wrap: break-word; color: #000; }
  .br { width: 10%; text-align: center; font-size: 9.5pt; }
  tfoot td { font-weight: bold; background: #e2e8f0 !important; border-top: 2px solid #000; padding: 7px 6px; }
  .foot-box { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; page-break-inside: avoid; }
  .box { border: 1px solid #555; padding: 8px 12px; font-size: 10pt; border-radius: 4px; }
  .box h4 { margin: 0 0 6px; font-size: 10.5pt; border-bottom: 1px solid #999; padding-bottom: 3px; }
  .box table { width: 100%; border-collapse: collapse; }
  .box td { padding: 3px 4px; border: none; font-size: 10pt; }
  .box td:last-child { text-align: left; direction: ltr; font-weight: bold; }
  .notes { border: 1px solid #555; padding: 8px 12px; font-size: 9.5pt; margin-top: 10px; page-break-inside: avoid; border-radius: 4px; }
  .notes strong { display: block; margin-bottom: 4px; font-size: 10.5pt; }
  .notes ol { margin: 0; padding-right: 20px; }
  .notes li { margin: 3px 0; }
  .signs { display: flex; justify-content: space-between; margin-top: 25px; font-size: 10pt; page-break-inside: avoid; }
  .signs div { width: 28%; text-align: center; }
  .signs .line { margin-top: 36px; border-top: 1px solid #000; padding-top: 4px; font-weight: bold; }
</style>
</head>
<body>
  <div class="header">
    <h1>${company}</h1>
    <div class="info">
      <div>كشف حساب معتمد: <b>${esc(who)}</b></div>
      <div>الفترة: <b>${monthName}</b> &nbsp;|&nbsp; من ${start.toLocaleDateString('en-CA')} إلى ${end.toLocaleDateString('en-CA')}</div>
      <div>الفرع: ${esc(selBranch === 'ALL' ? 'جميع الفروع' : selBranch)} &nbsp;|&nbsp; العملة: ${esc(selCurrency || '—')} &nbsp;|&nbsp; تاريخ الاستخراج: ${printDate}</div>
      ${subtitle || address || contact ? '<div>' + [subtitle, address, contact].filter(Boolean).join(' — ') + '</div>' : ''}
    </div>
  </div>

  <table class="ledger">
    <thead>
      <tr>
        <th>#</th>
        <th>التاريخ</th>
        <th>مدين (صادر)</th>
        <th>دائن (وارد)</th>
        <th>الرصيد</th>
        <th>البيان والملاحظات المحاسبية (كامل)</th>
        <th>الفرع</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:center">الإجمالي الكلي</td>
        <td class="num">${fmt(sumOut)}</td>
        <td class="num">${fmt(sumIn)}</td>
        <td class="num bal">${fmt(bal)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  <div class="foot-box">
    <div class="box">
      <h4>ملخص الأرصدة والسيولة</h4>
      <table>
        <tr><td>الرصيد الافتتاحي المرحل</td><td>${fmt(opening)}</td></tr>
        <tr><td>إجمالي الصادر (مدفوعات + تحويل صادر)</td><td>${fmt(sumOut)}</td></tr>
        <tr><td>إجمالي الوارد (مقبوضات + تحويل وارد)</td><td>${fmt(sumIn)}</td></tr>
        <tr><td>الرصيد الختامي المعتمد</td><td>${fmt(bal)}</td></tr>
      </table>
    </div>
    <div class="box">
      <h4>تصنيف الحركات في قائمة الأرباح والخسائر</h4>
      <table>
        <tr><td>محتسب في P&L — صادر</td><td>${fmt(sumInclOut)}</td></tr>
        <tr><td>محتسب في P&L — وارد</td><td>${fmt(sumInclIn)}</td></tr>
        <tr><td>مستبعد من P&L — تحويل صادر</td><td>${fmt(sumExclOut)}</td></tr>
        <tr><td>مستبعد من P&L — تحويل وارد</td><td>${fmt(sumExclIn)}</td></tr>
      </table>
    </div>
  </div>

  <div class="notes">
    <strong>إيضاحات التدقيق المالي والمطابقة</strong>
    <ol>
      ${notes.map(n => `<li>${esc(n)}</li>`).join('')}
    </ol>
  </div>

  <div class="signs">
    <div>المحاسب المسؤول<div class="line">التوقيع والتاريخ</div></div>
    <div>المراجع الداخلي<div class="line">التوقيع والتاريخ</div></div>
    <div>مدقق الحسابات المعتمد<div class="line">الختم والاعتماد</div></div>
  </div>

  <script>
    window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };
  </script>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) {
      toast('يرجى السماح بالنوافذ المنبثقة لطباعة كشف الصندوق');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  // Print P&L with all details
  const handlePrintPnlWithDetails = () => {
    const pnlTableEl = document.getElementById('pnl-main-table');
    if (!pnlTableEl) return;
    
    const sections = [
      { key: 'income', label: '1. تفاصيل الإيرادات والمبيعات المحققة' },
      { key: 'purchases', label: '2. تفاصيل المشتريات (تكلفة البضاعة المباعة)' }
    ];
    Object.entries(stats.byCat).sort((a, b) => Number(b[1]) - Number(a[1])).forEach(([cat]) => {
      sections.push({ key: 'cat:' + cat, label: 'تفاصيل مصروف: ' + cat });
    });
    if (stats.accrued > 0) {
      sections.push({ key: 'accrued', label: 'تفاصيل المستحقات المحاسبية (رواتب / إيجار / أخرى)' });
    }

    let detailsHtml = '<h3 style="text-align:center;margin:28px 0 14px;border-top:2px dashed #333;padding-top:14px;">كشوف تفاصيل بنود قائمة الأرباح والخسائر</h3>';
    sections.forEach(sec => {
      const rows = getDetailRows(sec.key);
      if (!rows.length) return;
      const total = rows.reduce((s, r) => s + (r.Amount || 0), 0);
      detailsHtml += `
        <div style="page-break-inside:avoid;margin-top:16px;">
          <h4 style="margin:0 0 6px;padding:4px 8px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:10pt;">
            ${esc(sec.label)} — عدد ${rows.length} حركة — الإجمالي: ${fmtC(total)}
          </h4>
          <table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:12px;">
            <thead>
              <tr style="background:#0f172a;color:#fff;">
                <th style="padding:5px 6px;border:1px solid #333;">#</th>
                <th style="padding:5px 6px;border:1px solid #333;">التاريخ</th>
                <th style="padding:5px 6px;border:1px solid #333;">البيان</th>
                <th style="padding:5px 6px;border:1px solid #333;">الموظف</th>
                <th style="padding:5px 6px;border:1px solid #333;">الفرع</th>
                <th style="padding:5px 6px;border:1px solid #333;">التصنيف</th>
                <th style="padding:5px 6px;border:1px solid #333;text-align:left;">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r, i) => `
                <tr>
                  <td style="padding:4px 6px;border:1px solid #ccc;text-align:center;">${i + 1}</td>
                  <td style="padding:4px 6px;border:1px solid #ccc;white-space:nowrap;">${r.DateStr || '—'}</td>
                  <td style="padding:4px 6px;border:1px solid #ccc;font-weight:600;">${esc(r.Description || '—')}</td>
                  <td style="padding:4px 6px;border:1px solid #ccc;">${esc(r.Employee || '—')}</td>
                  <td style="padding:4px 6px;border:1px solid #ccc;">${esc(r.Branch || '—')}</td>
                  <td style="padding:4px 6px;border:1px solid #ccc;">${esc(r.Category || '—')}</td>
                  <td style="padding:4px 6px;border:1px solid #ccc;text-align:left;font-weight:bold;">${fmtC(r.Amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const company = esc(headerConfig.company || 'نظام التدقيق المالي المعتمد');
    const monthName = `${MONTH_AR[selMonth]} ${selYear}`;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقرير قائمة الأرباح والخسائر والتفاصيل — ${monthName}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  body { font-family: 'IBM Plex Sans Arabic', Tahoma, Arial, sans-serif; padding: 10px; font-size: 10pt; color: #000; }
  h2 { margin: 0 0 4px; font-size: 15pt; text-align: center; }
  .sub { text-align: center; font-size: 10pt; color: #444; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: right; }
  th { background: #0f172a; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pnl-net { background: #0f172a !important; color: #fff !important; font-weight: bold; font-size: 11pt; -webkit-print-color-adjust: exact; }
  .signs { display: flex; justify-content: space-between; margin-top: 35px; page-break-inside: avoid; }
  .signs div { width: 30%; text-align: center; }
  .signs .line { margin-top: 35px; border-top: 1px solid #000; padding-top: 4px; font-weight: bold; }
</style>
</head>
<body>
  <h2>${company}</h2>
  <div class="sub">
    تقرير قائمة الأرباح والخسائر الشهري المعتمد — ${monthName} | الفرع: ${selBranch === 'ALL' ? 'مجمّع' : selBranch} | العملة: ${selCurrency}
  </div>
  ${pnlTableEl.outerHTML}
  ${detailsHtml}
  <div class="signs">
    <div>المحاسب المسؤول<div class="line">التوقيع</div></div>
    <div>المراجع الداخلي<div class="line">التوقيع</div></div>
    <div>الاعتماد المالي<div class="line">الختم والتوقيع</div></div>
  </div>
  <script>
    window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  // Export full multi-sheet Excel Workbook (8 detailed sheets)
  const handleExportWorkbook = () => {
    if (!viewData.length) {
      toast('لا توجد بيانات متاحة في هذه الفترة لتصدير الإكسيل');
      return;
    }
    saveCurrentMonthState(false);

    const included = viewData.filter(r => r.isExcluded === 0);
    const excluded = viewData.filter(r => r.isExcluded === 1);
    const incomeRows = included.filter(r => r.Type === 'Income');
    const expenseRows = included.filter(r => r.Type === 'Expense');
    const purchaseRows = expenseRows.filter(r => COGS_CATS.has(r.Category));
    const opexRows = expenseRows.filter(r => !COGS_CATS.has(r.Category));

    const mapRow = (r: PLTransaction) => ({
      'ID': r.ID,
      'التاريخ': r.DateStr,
      'الموظف': r.Employee,
      'الفرع': r.Branch,
      'النوع': r.Type,
      'التصنيف': r.Category,
      'المبلغ': r.Amount,
      'البيان والتفاصيل': r.Description,
      'رقم الربط': r.Related_ID || '',
      'الحالة في P&L': r.isExcluded === 1 ? 'مستبعد' : 'محتسب'
    });

    // Sheet 1: P&L Statement
    const monthName = `${MONTH_AR[selMonth]} ${selYear}`;
    const pnlSheet: any[] = [
      { 'البند المحاسبي': headerConfig.company || 'نظام التدقيق المالي المعتمد', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': 'ترويسة التقرير' },
      { 'البند المحاسبي': headerConfig.subtitle || '', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': `الفترة: ${monthName}`, 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': `الفرع: ${selBranch === 'ALL' ? 'جميع الفروع (مجمّع)' : selBranch}`, 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': `العملة: ${selCurrency || 'د.ك'}`, 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': '', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': '1. الإيرادات والمبيعات المحققة', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': 'إجمالي الإيرادات التشغيلية', 'المبلغ': stats.income, 'النسبة %': '100%', 'ملاحظات': `${incomeRows.length} حركة إيراد` },
      { 'البند المحاسبي': '', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': '2. تكلفة البضاعة المباعة (COGS)', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': 'مخزون أول المدة', 'المبلغ': stats.op, 'النسبة %': '', 'ملاحظات': 'إدخال دفتري معتمد' },
      { 'البند المحاسبي': '(+) مشتريات الفترة', 'المبلغ': stats.purchases, 'النسبة %': '', 'ملاحظات': `${purchaseRows.length} حركة مشتريات` },
      { 'البند المحاسبي': '(−) مخزون آخر المدة', 'المبلغ': stats.cl, 'النسبة %': '', 'ملاحظات': 'جرد فعلي معتمد' },
      { 'البند المحاسبي': 'تكلفة البضاعة المباعة الإجمالية', 'المبلغ': stats.cogs, 'النسبة %': pct(stats.cogs, stats.income), 'ملاحظات': 'أول + مشتريات - آخر' },
      { 'البند المحاسبي': '', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': 'مجمل الربح التجاري', 'المبلغ': stats.gross, 'النسبة %': pct(stats.gross, stats.income), 'ملاحظات': 'الإيرادات - تكلفة البضاعة' },
      { 'البند المحاسبي': '', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': '3. المصروفات التشغيلية', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' }
    ];

    Object.entries(stats.byCat).sort((a, b) => Number(b[1]) - Number(a[1])).forEach(([cat, val]) => {
      pnlSheet.push({
        'البند المحاسبي': '— ' + cat,
        'المبلغ': Number(val),
        'النسبة %': pct(Number(val), stats.income),
        'ملاحظات': ''
      });
    });

    if (stats.accrued > 0) {
      pnlSheet.push({
        'البند المحاسبي': 'مصروفات مستحقة (أساس الاستحقاق)',
        'المبلغ': stats.accrued,
        'النسبة %': pct(stats.accrued, stats.income),
        'ملاحظات': `رواتب (${stats.accS}) | إيجار (${stats.accR}) | أخرى (${stats.accO})`
      });
    }

    pnlSheet.push(
      { 'البند المحاسبي': 'إجمالي المصروفات التشغيلية والمستحقة', 'المبلغ': stats.opex + stats.accrued, 'النسبة %': pct(stats.opex + stats.accrued, stats.income), 'ملاحظات': '' },
      { 'البند المحاسبي': '', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': 'صافي الربح / (الخسارة) النهائي المعتمد', 'المبلغ': stats.net, 'النسبة %': pct(stats.net, stats.income), 'ملاحظات': stats.net >= 0 ? 'صافي ربح' : 'صافي خسارة' },
      { 'البند المحاسبي': '', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': 'ملخص تدقيق الحركات', 'المبلغ': '', 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': 'إجمالي حركات الفترة', 'المبلغ': viewData.length, 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': 'حركات محتسبة في الأرباح والخسائر', 'المبلغ': included.length, 'النسبة %': '', 'ملاحظات': '' },
      { 'البند المحاسبي': 'حركات مستبعدة (تحويلات/تسويات عهد)', 'المبلغ': excluded.length, 'النسبة %': '', 'ملاحظات': 'عزل محاسبي لمنع الازدواج' }
    );

    // Sheet 8: Funds export rows
    const fundsExportRows: any[] = [];
    const fundsListExport = Object.values(fundsMap) as FundSummary[];
    fundsListExport.forEach(f => {
      const netPL = f.receipts - f.payments;
      fundsExportRows.push({
        'النوع': 'ملخص الصندوق',
        'الصندوق': f.name,
        'رصيد أول': f.opening,
        'مقبوضات': f.receipts,
        'مدفوعات': f.payments,
        'تحويل وارد': f.tin,
        'تحويل صادر': f.tout,
        'صافي يخص P&L': netPL,
        'رصيد آخر': f.closing,
        'عدد الحركات': f.count,
        'الإيضاح': `صندوق ${f.name}: رصيد أول ${fmt(f.opening)} | مقبوضات ${fmt(f.receipts)} | مدفوعات ${fmt(f.payments)} | تحويلات ${fmt(f.tin - f.tout)} | رصيد آخر ${fmt(f.closing)}`
      });
      f.lines.forEach((r, i) => {
        const isT = r.Type === 'Transfer-In' || r.Type === 'Transfer-Out';
        fundsExportRows.push({
          'النوع': 'حركة تفصيلية',
          'الصندوق': f.name,
          'رقم': i + 1,
          'التاريخ': r.DateStr || '',
          'الموظف': r.Employee || '',
          'الفرع': r.Branch || '',
          'النوع المالي': r.Type || '',
          'التصنيف': r.Category || '',
          'البيان': r.Description || '',
          'المبلغ': r.Amount || 0,
          'الحالة في P&L': isT || r.isExcluded === 1 ? 'مستبعد' : 'محتسب'
        });
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pnlSheet), 'قائمة_الأرباح_والخسائر');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(included.map(mapRow)), 'الحركات_المحتسبة');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excluded.map(r => ({
      ...mapRow(r),
      'سبب الاستبعاد': 'تحويل عهدة / تسوية نقدية بين موظفين أو فروع — لا يحسب إيراد أو مصروف'
    }))), 'الحركات_المستبعدة');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeRows.map(mapRow)), 'تفاصيل_الإيرادات');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchaseRows.map(mapRow)), 'تفاصيل_المشتريات');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opexRows.map(mapRow)), 'تفاصيل_المصروفات');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accrualLines.map(a => ({
      '#': a.id,
      'النوع': a.type,
      'الموظف / الجهة': a.employee,
      'الفرع': a.branch,
      'المبلغ': a.amount,
      'البيان': a.description
    }))), 'المستحقات_التفصيلية');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fundsExportRows.length ? fundsExportRows : [{ 'ملاحظة': 'لا توجد بيانات' }]), 'إيضاحات_الصناديق');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(viewData.map(mapRow)), 'كل_الحركات');

    const fileName = `قائمة_الأرباح_والخسائر_${MONTH_AR[selMonth]}_${selYear}_${selBranch === 'ALL' ? 'مجمع' : selBranch}.xlsx`;
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`تم تصدير ملف الإكسيل الشامل (8 ورقات عمل): ${fileName}`);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!viewData.length) {
      toast('لا توجد بيانات للتصدير');
      return;
    }
    const rows = viewData.map(r => ({
      'ID': r.ID,
      'التاريخ': r.DateStr,
      'الموظف': r.Employee,
      'الفرع': r.Branch,
      'النوع': r.Type,
      'التصنيف': r.Category,
      'المبلغ': r.Amount,
      'البيان': r.Description,
      'الحالة': r.isExcluded === 1 ? 'مستبعد' : 'محتسب'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `حركات_الأرباح_والخسائر_${MONTH_AR[selMonth]}_${selYear}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('تم تصدير ملف CSV');
  };

  // Export PDF with jsPDF
  const handleExportPDF = () => {
    if (!viewData.length) {
      toast('لا توجد بيانات');
      return;
    }
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const monthName = `${MONTH_AR[selMonth]} ${selYear}`;
      const title = headerConfig.company || 'Financial Audit & P&L Statement';

      doc.setFontSize(14);
      doc.text(title, pageW / 2, 15, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`P&L Statement - ${monthName} | Branch: ${selBranch === 'ALL' ? 'All' : selBranch}`, pageW / 2, 22, { align: 'center' });
      doc.text(`Date: ${new Date().toLocaleDateString('en-CA')}`, pageW / 2, 28, { align: 'center' });

      const pnlBody = [
        ['1. Revenue / Sales', fmt(stats.income), '100%'],
        ['Opening Inventory', fmt(stats.op), ''],
        ['(+) Purchases', fmt(stats.purchases), ''],
        ['(-) Closing Inventory', fmt(stats.cl), ''],
        ['2. Cost of Goods Sold (COGS)', fmt(stats.cogs), pct(stats.cogs, stats.income)],
        ['Gross Profit', fmt(stats.gross), pct(stats.gross, stats.income)],
        ['3. Operating Expenses (OPEX)', fmt(stats.opex), pct(stats.opex, stats.income)],
        ['Accruals (Salaries/Rent/Other)', fmt(stats.accrued), pct(stats.accrued, stats.income)],
        ['Total Operating Expenses', fmt(stats.opex + stats.accrued), pct(stats.opex + stats.accrued, stats.income)],
        ['Net Profit / (Loss)', fmt(stats.net), pct(stats.net, stats.income)]
      ];

      (doc as any).autoTable({
        startY: 34,
        head: [['P&L Accounting Item', `Amount (${selCurrency || 'KWD'})`, '% of Revenue']],
        body: pnlBody,
        styles: { fontSize: 9, halign: 'right' },
        headStyles: { fillColor: [11, 29, 54] },
        margin: { left: 14, right: 14 }
      });

      const fileName = `قائمة_الأرباح_والخسائر_${MONTH_AR[selMonth]}_${selYear}.pdf`;
      doc.save(fileName);
      toast(`تم تصدير ملف PDF: ${fileName}`);
    } catch (e) {
      console.error(e);
      toast('تعذر إنشاء PDF — جاري فتح نافذة الطباعة كبديل');
      handlePrintPnlWithDetails();
    }
  };

  // Row modal operations
  const handleOpenEditModal = (idx: number, defaultType: string = 'Expense') => {
    if (idx >= 0 && monthData[idx]) {
      const r = monthData[idx];
      setEditModalData({
        isOpen: true,
        idx,
        targetUid: r._uid,
        targetId: r.ID || r._uid,
        DateStr: r.DateStr || '',
        Branch: r.Branch || (availableBranches[0] || 'الرئيسي'),
        Employee: r.Employee || (availableEmployees[0] || ''),
        Type: r.Type || defaultType,
        Category: r.Category || (defaultType === 'Income' ? 'مبيعات' : 'نثريات'),
        Amount: r.Amount || 0,
        isExcluded: r.isExcluded || 0,
        Description: r.Description || ''
      });
    } else {
      setEditModalData({
        isOpen: true,
        idx: -1,
        targetUid: undefined,
        targetId: undefined,
        DateStr: new Date().toISOString().slice(0, 10),
        Branch: selBranch === 'ALL' ? (availableBranches[0] || 'الرئيسي') : selBranch,
        Employee: availableEmployees[0] || 'كاشير الفرع الرئيسي',
        Type: defaultType,
        Category: defaultType === 'Income' ? 'مبيعات' : '',
        Amount: '',
        isExcluded: 0,
        Description: ''
      });
    }
  };

  const handleSaveModalRow = async () => {
    if (!editModalData) return;
    const amt = parseFloat(String(editModalData.Amount));
    if (isNaN(amt) || amt <= 0) {
      toast('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }
    const dateVal = editModalData.DateStr || new Date().toISOString().slice(0, 10);
    const dateObj = dateVal ? new Date(dateVal + 'T12:00:00') : new Date();
    const branchVal = editModalData.Branch.trim() || (availableBranches[0] || 'الرئيسي');
    const empVal = editModalData.Employee.trim() || (availableEmployees[0] || 'كاشير الفرع الرئيسي');
    const typeVal = editModalData.Type || 'Income';
    const catVal = editModalData.Category.trim() || (typeVal === 'Income' ? 'مبيعات' : 'نثريات');
    const descVal = editModalData.Description.trim() || (typeVal === 'Income' ? `مبيعات فرع ${branchVal}` : `مصروف ${catVal}`);
    const isExclVal = editModalData.isExcluded || 0;

    setSavingRow(true);
    try {
      if (editModalData.targetUid !== undefined || (editModalData.idx >= 0 && monthData[editModalData.idx])) {
        // UPDATE EXISTING ROW
        const targetRow = editModalData.targetUid !== undefined
          ? allData.find(r => r._uid === editModalData.targetUid)
          : monthData[editModalData.idx];
        const targetId = String(editModalData.targetId || targetRow?.ID || targetRow?._uid || '');

        const updatePayload = {
          id: targetId,
          date: dateVal,
          branch: branchVal,
          employee: empVal,
          type: typeVal,
          category: catVal,
          amount: amt,
          description: descVal,
          targetMonth: periodKey,
          isExcluded: isExclVal
        };

        // 1. Update in backend API
        await apiService.updateTransaction(targetId, updatePayload);
        // 2. Update in Google Sheets
        gasService.updateTransaction(targetId, updatePayload).catch(() => {});

        // 3. Update in local state
        const updatedList = allData.map(r => {
          if (r._uid === (editModalData.targetUid ?? targetRow?._uid)) {
            return {
              ...r,
              Date: dateObj,
              DateStr: dateVal,
              Branch: branchVal,
              Employee: empVal,
              Type: typeVal,
              Category: catVal,
              Amount: amt,
              isExcluded: isExclVal,
              Description: descVal
            };
          }
          return r;
        });
        setAllData(updatedList);
        saveCurrentMonthState(false, updatedList);
        toast(`✅ تم تحديث وحفظ ${typeVal === 'Income' ? 'حركة المبيعات / الإيراد' : 'المعاملة'} بنجاح`);
      } else {
        // CREATE NEW ROW (e.g. New Income / Sale)
        const newId = Date.now();
        const txPayload = {
          id: String(newId),
          rowId: String(newId),
          date: dateVal,
          branch: branchVal,
          employee: empVal,
          type: typeVal,
          category: catVal,
          amount: amt,
          description: descVal,
          targetMonth: periodKey
        };

        // 1. Post to backend API
        const serverRes = await apiService.addTransaction(txPayload);
        const resolvedId = (serverRes && serverRes.id) ? serverRes.id : newId;

        // 2. Post to Google Sheets
        gasService.addTransaction({
          Date: dateVal,
          Branch: branchVal,
          Employee: empVal,
          Type: typeVal === 'Income' ? 'إيراد' : 'مصروف',
          Category: catVal,
          Amount: amt,
          Description: descVal,
          TargetMonth: periodKey
        }).catch(() => {});

        // 3. Add to local allData state
        const newTxn: PLTransaction = {
          _uid: Number(resolvedId) || newId,
          ID: Number(resolvedId) || newId,
          Date: dateObj,
          DateStr: dateVal,
          Branch: branchVal,
          Employee: empVal,
          Type: typeVal,
          Category: catVal,
          Amount: amt,
          isExcluded: isExclVal,
          Description: descVal
        };

        const updatedList = [newTxn, ...allData];
        setAllData(updatedList);
        saveCurrentMonthState(false, updatedList);
        toast(`✅ تم حفظ وتسجيل ${typeVal === 'Income' ? 'المبيعات / الإيراد المحقق' : 'المعاملة'} بنجاح في السيرفر وشيت جوجل وقاعدة البيانات`);
      }

      onRefresh?.();
      setEditModalData(null);
    } catch (err: any) {
      console.error('Error saving transaction in P&L:', err);
      toast('حدث خطأ أثناء الحفظ: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setSavingRow(false);
    }
  };

  const handleToggleExclusion = (targetUid: number) => {
    const updated = allData.map(r => {
      if (r._uid === targetUid) {
        const nextState = r.isExcluded === 1 ? 0 : 1;
        toast(nextState === 1 ? 'تم استبعاد الحركة من P&L' : 'تم تفعيل الحركة في P&L');
        return { ...r, isExcluded: nextState };
      }
      return r;
    });
    setAllData(updated);
    saveCurrentMonthState(false, updated);
  };

  const handleDeleteTransaction = async (targetUid: number) => {
    const row = allData.find(r => r._uid === targetUid);
    if (!row) return;
    if (!window.confirm(`هل أنت متأكد من حذف هذه المعاملة (${row.Description || row.Category}) بقيمة ${fmtC(row.Amount)} نهائياً؟`)) {
      return;
    }
    try {
      const idToDelete = String(row.ID || row._uid);
      await apiService.deleteTransaction(idToDelete);
      gasService.deleteTransaction(idToDelete).catch(() => {});
      const updated = allData.filter(r => r._uid !== targetUid);
      setAllData(updated);
      saveCurrentMonthState(false, updated);
      toast('تم حذف المعاملة وتحديث السجلات بنجاح');
      onRefresh?.();
    } catch (e: any) {
      toast('تعذر الحذف: ' + e.message);
    }
  };

  const handleDeleteRow = handleDeleteTransaction;

  // Quick Direct Sale Form submission in Tab 2
  const handleQuickAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(quickSaleAmount);
    if (isNaN(amt) || amt <= 0) {
      toast('يرجى كتابة مبلغ إيراد صحيح أكبر من الصفر');
      return;
    }
    const branchVal = quickSaleBranch.trim() || (selBranch !== 'ALL' ? selBranch : (availableBranches[0] || 'الرئيسي'));
    const empVal = quickSaleEmployee.trim() || (availableEmployees[0] || 'كاشير الفرع الرئيسي');
    const dateVal = quickSaleDate || new Date().toISOString().slice(0, 10);
    const dateObj = new Date(dateVal + 'T12:00:00');
    const catVal = quickSaleCategory.trim() || 'مبيعات';
    const descVal = quickSaleDesc.trim() || `مبيعات وإيرادات فرع ${branchVal}`;

    setQuickSaleSubmitting(true);
    try {
      const newId = Date.now();
      const txPayload = {
        id: String(newId),
        rowId: String(newId),
        date: dateVal,
        branch: branchVal,
        employee: empVal,
        type: 'Income',
        category: catVal,
        amount: amt,
        description: descVal,
        targetMonth: periodKey
      };

      // 1. Save to Backend Server API
      const serverRes = await apiService.addTransaction(txPayload);
      const resolvedId = (serverRes && serverRes.id) ? serverRes.id : newId;

      // 2. Save to Google Sheets
      gasService.addTransaction({
        Date: dateVal,
        Branch: branchVal,
        Employee: empVal,
        Type: 'إيراد',
        Category: catVal,
        Amount: amt,
        Description: descVal,
        TargetMonth: periodKey
      }).catch(() => {});

      // 3. Update local state
      const newTxn: PLTransaction = {
        _uid: Number(resolvedId) || newId,
        ID: Number(resolvedId) || newId,
        Date: dateObj,
        DateStr: dateVal,
        Branch: branchVal,
        Employee: empVal,
        Type: 'Income',
        Category: catVal,
        Amount: amt,
        isExcluded: 0,
        Description: descVal
      };

      const updatedList = [newTxn, ...allData];
      setAllData(updatedList);
      saveCurrentMonthState(false, updatedList);

      // Reset quick fields
      setQuickSaleAmount('');
      setQuickSaleDesc('');
      toast(`✅ تم حفظ وتثبيت إيراد (${descVal}) بمبلغ ${fmtC(amt)} بنجاح في السيرفر وشيت جوجل`);
      onRefresh?.();
    } catch (err: any) {
      console.error('Failed to quick add sale:', err);
      toast('خطأ أثناء حفظ الإيراد: ' + (err.message || 'فشل الاتصال'));
    } finally {
      setQuickSaleSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-12 font-sans" dir="rtl">
      {/* Hidden file input for Excel upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Loading Overlay */}
      {loadingMsg && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
            <RefreshCw size={36} className="animate-spin text-blue-600 mx-auto" />
            <h3 className="font-black text-slate-900 text-lg">جاري معالجة البيانات المحاسبية</h3>
            <p className="text-sm text-slate-600">{loadingMsg}</p>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-400/20 text-amber-300 rounded-xl border border-amber-400/30">
            <Scale size={24} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <span>نظام التدقيق المالي المعتمد</span>
              <span className="text-amber-400 font-bold">— قائمة الأرباح والخسائر</span>
            </h1>
            <p className="text-xs text-slate-400">تدقيق محايد كامل · عزل التحويلات لمنع الازدواج · أساس الاستحقاق</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
            title="رفع ملف Excel به حركات وأرصدة"
          >
            <FileSpreadsheet size={15} className="text-emerald-400" />
            <span>رفع Excel</span>
          </button>

          <button
            type="button"
            onClick={loadLiveData}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
            title="مزامنة حية من Google Sheets"
          >
            <RefreshCw size={15} className="text-blue-400" />
            <span>مزامنة سحابية</span>
          </button>

          <button
            type="button"
            onClick={() => saveCurrentMonthState(true)}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
            title="حفظ بيانات الشهر والمخزون والمستحقات"
          >
            <Save size={15} className="text-amber-400" />
            <span>حفظ الشهر</span>
          </button>

          <button
            type="button"
            onClick={handleExportWorkbook}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
            title="تصدير تقرير Excel بـ 8 ورقات عمل شاملة"
          >
            <FileDown size={15} className="text-emerald-300" />
            <span>تقرير Excel شامل</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
            title="تصدير تقرير PDF معتمد"
          >
            <FileText size={15} className="text-rose-400" />
            <span>تقرير PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
          >
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPnlWithDetails}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Printer size={15} />
            <span>طباعة القائمة</span>
          </button>
        </div>
      </div>

      {/* ACCORDION: REPORT HEADER CUSTOMIZATION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsHeaderOpen(!isHeaderOpen)}
          className="w-full px-5 py-3.5 bg-gradient-to-l from-slate-900 to-indigo-950 text-white font-bold text-sm flex items-center justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Building size={16} className="text-amber-400" />
            <span>ترويسة التقرير المعتمدة — اضغط لفتح أو إغلاق الحقول</span>
          </div>
          {isHeaderOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {isHeaderOpen && (
          <div className="p-4 sm:p-5 space-y-4 bg-slate-50/70 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المكتب / الشركة</label>
                <input
                  type="text"
                  value={headerConfig.company}
                  onChange={e => setHeaderConfig({ ...headerConfig, company: e.target.value })}
                  placeholder="مثال: مكتب التدقيق والاستشارات المحاسبية"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان الفرعي / النشاط</label>
                <input
                  type="text"
                  value={headerConfig.subtitle}
                  onChange={e => setHeaderConfig({ ...headerConfig, subtitle: e.target.value })}
                  placeholder="محاسبة · تدقيق · استشارات"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان الكامل</label>
                <input
                  type="text"
                  value={headerConfig.address}
                  onChange={e => setHeaderConfig({ ...headerConfig, address: e.target.value })}
                  placeholder="دولة الكويت — الشرق — مجمع..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الهاتف</label>
                <input
                  type="text"
                  value={headerConfig.phone}
                  onChange={e => setHeaderConfig({ ...headerConfig, phone: e.target.value })}
                  placeholder="هاتف / جوال"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={headerConfig.email}
                  onChange={e => setHeaderConfig({ ...headerConfig, email: e.target.value })}
                  placeholder="audit@example.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الترخيص / السجل التجاري</label>
                <input
                  type="text"
                  value={headerConfig.license}
                  onChange={e => setHeaderConfig({ ...headerConfig, license: e.target.value })}
                  placeholder="رقم الترخيص أو السجل"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveHeader}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
                >
                  حفظ الترويسة
                </button>
                <button
                  type="button"
                  onClick={handleClearHeader}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  مسح الحقول
                </button>
              </div>
              <span className="text-[11px] text-slate-500">تُحفظ في المتصفح وتظهر رسمياً في الطباعة وتصدير الإكسيل والـ PDF</span>
            </div>
          </div>
        )}
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs border-r-4 border-r-amber-500">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">السنة</label>
            <select
              value={selYear}
              onChange={e => setSelYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الشهر</label>
            <select
              value={selMonth}
              onChange={e => setSelMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900"
            >
              {MONTH_AR.map((m, idx) => idx > 0 ? (
                <option key={idx} value={idx}>{m} ({idx})</option>
              ) : null)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الفرع</label>
            <select
              value={selBranch}
              onChange={e => setSelBranch(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
            >
              <option value="ALL">جميع الفروع (مجمّع)</option>
              {availableBranches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">العملة</label>
            <select
              value={selCurrency}
              onChange={e => setSelCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
            >
              <option value="د.ك">دينار كويتي (د.ك)</option>
              <option value="ج.م">جنيه مصري (ج.م)</option>
              <option value="">بدون رمز عملة</option>
            </select>
          </div>

          <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-2">
            <span className="px-3 py-2 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-black">
              {viewData.filter(r => r.isExcluded === 0).length.toLocaleString('ar-KW')} حركة معتمدة
            </span>
            <button
              type="button"
              onClick={() => handleOpenEditModal(-1)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer"
            >
              <Plus size={14} className="stroke-[3]" />
              <span>إضافة حركة</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs border-r-4 border-r-emerald-500">
          <div className="text-xs font-bold text-slate-500 mb-1">إجمالي الإيرادات</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700">{fmtC(stats.income)}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs border-r-4 border-r-amber-500">
          <div className="text-xs font-bold text-slate-500 mb-1">تكلفة البضاعة المباعة (COGS)</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-700">{fmtC(stats.cogs)}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs border-r-4 border-r-rose-500">
          <div className="text-xs font-bold text-slate-500 mb-1">المصروفات التشغيلية + المستحقات</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-700">{fmtC(stats.opex + stats.accrued)}</div>
        </div>

        <div className={`bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs border-r-4 ${stats.net >= 0 ? 'border-r-blue-600' : 'border-r-red-600'}`}>
          <div className="text-xs font-bold text-slate-500 mb-1">صافي الربح / (الخسارة)</div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${stats.net >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {stats.net < 0 ? `(${fmtC(Math.abs(stats.net))})` : fmtC(stats.net)}
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('pnl')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'pnl' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText size={15} />
          <span>قائمة الأرباح والخسائر</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'sales' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wallet size={15} />
          <span>المبيعات والإيرادات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inv')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'inv' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Boxes size={15} />
          <span>المخزون والاستحقاق</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trans')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'trans' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ArrowRightLeft size={15} />
          <span>التحويلات المستبعدة ({viewData.filter(r => r.isExcluded === 1).length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'audit' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ListChecks size={15} />
          <span>سجل الحركات والتعديل</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('classify')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'classify' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Tags size={15} />
          <span>إعادة التصنيف</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('funds')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'funds' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wallet size={15} />
          <span>إيضاحات الصناديق</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: P&L OFFICIAL STATEMENT                                             */}
      {/* ========================================================================= */}
      {activeTab === 'pnl' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-gradient-to-l from-slate-900 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Scale size={18} className="text-amber-400" />
              <span className="font-extrabold text-sm sm:text-base">قائمة الأرباح والخسائر الرسمية</span>
              <span className="text-xs text-slate-400 font-normal">(انقر على أي بند لعرض التفاصيل وتدقيق الحركات)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintPnlWithDetails}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
              >
                <Printer size={13} className="inline ml-1" />
                <span>طباعة القائمة + التفاصيل</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
              >
                <span>طباعة الشاشة</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto p-2">
            <table className="w-full text-right border-collapse" id="pnl-main-table">
              <thead>
                <tr className="bg-slate-900 text-white text-xs">
                  <th className="py-3 px-4 font-bold border-b border-slate-800 text-right w-1/2">البند المحاسبي</th>
                  <th className="py-3 px-4 font-bold border-b border-slate-800 text-left w-1/4">المبلغ</th>
                  <th className="py-3 px-4 font-bold border-b border-slate-800 text-left w-1/4">% من الإيراد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                {/* 1. REVENUE */}
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td colSpan={3} className="py-2.5 px-4 text-xs font-black text-slate-800">
                    1. الإيرادات والمبيعات المحققة
                  </td>
                </tr>
                <tr
                  onClick={() => setDetailModal({ isOpen: true, key: 'income', label: 'إجمالي الإيرادات التشغيلية' })}
                  className="hover:bg-blue-50/70 cursor-pointer transition-colors group"
                >
                  <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center justify-between">
                    <span>إجمالي الإيرادات التشغيلية</span>
                    <span className="text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 font-semibold transition-opacity">◀ تفاصيل الحركات</span>
                  </td>
                  <td className="py-2.5 px-4 text-left font-mono font-bold text-emerald-700">{fmtC(stats.income)}</td>
                  <td className="py-2.5 px-4 text-left font-mono text-slate-600">100%</td>
                </tr>
                <tr className="bg-slate-50 font-bold border-t border-slate-300">
                  <td className="py-2.5 px-4 text-slate-800 font-black">إجمالي الإيرادات</td>
                  <td className="py-2.5 px-4 text-left font-mono font-black text-emerald-700">{fmtC(stats.income)}</td>
                  <td className="py-2.5 px-4 text-left font-mono font-bold text-slate-700">100%</td>
                </tr>

                {/* 2. COGS */}
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td colSpan={3} className="py-2.5 px-4 text-xs font-black text-slate-800">
                    2. تكلفة البضاعة المباعة (COGS)
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700 pr-8">مخزون أول المدة</td>
                  <td className="py-2.5 px-4 text-left font-mono font-bold text-amber-700">{fmtC(stats.op)}</td>
                  <td className="py-2.5 px-4 text-left font-mono text-slate-500">{pct(stats.op, stats.income)}</td>
                </tr>
                <tr
                  onClick={() => setDetailModal({ isOpen: true, key: 'purchases', label: 'مشتريات الفترة' })}
                  className="hover:bg-blue-50/70 cursor-pointer transition-colors group"
                >
                  <td className="py-2.5 px-4 text-slate-900 font-bold pr-8 flex items-center justify-between">
                    <span>(+) مشتريات الفترة</span>
                    <span className="text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 font-semibold transition-opacity">◀ تفاصيل الفواتير</span>
                  </td>
                  <td className="py-2.5 px-4 text-left font-mono font-bold text-amber-700">{fmtC(stats.purchases)}</td>
                  <td className="py-2.5 px-4 text-left font-mono text-slate-500">{pct(stats.purchases, stats.income)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700 pr-8">(−) مخزون آخر المدة (الجرد الفعلي)</td>
                  <td className="py-2.5 px-4 text-left font-mono font-bold text-emerald-700">({fmtC(stats.cl)})</td>
                  <td className="py-2.5 px-4 text-left font-mono text-slate-500">{pct(stats.cl, stats.income)}</td>
                </tr>
                <tr className="bg-slate-50 font-bold border-t border-slate-300">
                  <td className="py-2.5 px-4 text-slate-800 font-black">تكلفة البضاعة المباعة</td>
                  <td className="py-2.5 px-4 text-left font-mono font-black text-amber-700">{fmtC(stats.cogs)}</td>
                  <td className="py-2.5 px-4 text-left font-mono font-bold text-slate-700">{pct(stats.cogs, stats.income)}</td>
                </tr>

                {/* GROSS PROFIT */}
                <tr className="bg-teal-50/80 font-black border-t-2 border-b-2 border-teal-200">
                  <td className="py-3 px-4 text-teal-950 font-black text-sm">مجمل الربح التجاري</td>
                  <td className={`py-3 px-4 text-left font-mono font-black text-base ${stats.gross >= 0 ? 'text-teal-800' : 'text-rose-700'}`}>
                    {fmtC(stats.gross)}
                  </td>
                  <td className="py-3 px-4 text-left font-mono font-black text-teal-900">{pct(stats.gross, stats.income)}</td>
                </tr>

                {/* 3. OPEX */}
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td colSpan={3} className="py-2.5 px-4 text-xs font-black text-slate-800">
                    3. المصروفات التشغيلية والمستحقة
                  </td>
                </tr>
                {Object.entries(stats.byCat).sort((a, b) => Number(b[1]) - Number(a[1])).map(([cat, val]) => (
                  <tr
                    key={cat}
                    onClick={() => setDetailModal({ isOpen: true, key: 'cat:' + cat, label: 'مصروف: ' + cat })}
                    className="hover:bg-blue-50/70 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-4 text-slate-800 font-semibold pr-8 flex items-center justify-between">
                      <span>— {cat}</span>
                      <span className="text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 font-semibold transition-opacity">◀ تفاصيل</span>
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono font-bold text-rose-700">{fmtC(Number(val))}</td>
                    <td className="py-2.5 px-4 text-left font-mono text-slate-500">{pct(Number(val), stats.income)}</td>
                  </tr>
                ))}

                {/* Accruals */}
                {stats.accrued > 0 && (
                  <>
                    <tr
                      onClick={() => setDetailModal({ isOpen: true, key: 'accrued', label: 'المصروفات المستحقة' })}
                      className="hover:bg-amber-50 cursor-pointer transition-colors group bg-amber-50/40"
                    >
                      <td className="py-2.5 px-4 text-amber-950 font-bold pr-8 flex items-center justify-between">
                        <span>المصروفات المستحقة (أساس الاستحقاق)</span>
                        <span className="text-[11px] text-amber-700 opacity-0 group-hover:opacity-100 font-semibold transition-opacity">◀ تفاصيل المستحقات</span>
                      </td>
                      <td className="py-2.5 px-4 text-left font-mono font-bold text-rose-700">{fmtC(stats.accrued)}</td>
                      <td className="py-2.5 px-4 text-left font-mono text-slate-500">{pct(stats.accrued, stats.income)}</td>
                    </tr>
                    {stats.accS > 0 && (
                      <tr
                        onClick={() => setDetailModal({ isOpen: true, key: 'accrued:رواتب', label: 'رواتب مستحقة' })}
                        className="hover:bg-amber-50/60 cursor-pointer text-slate-600"
                      >
                        <td className="py-2 px-4 pr-12 text-xs font-semibold text-slate-700">— رواتب مستحقة غير مدفوعة</td>
                        <td className="py-2 px-4 text-left font-mono text-rose-600">{fmtC(stats.accS)}</td>
                        <td className="py-2 px-4 text-left font-mono text-slate-400">{pct(stats.accS, stats.income)}</td>
                      </tr>
                    )}
                    {stats.accR > 0 && (
                      <tr
                        onClick={() => setDetailModal({ isOpen: true, key: 'accrued:إيجار', label: 'إيجار مستحق' })}
                        className="hover:bg-amber-50/60 cursor-pointer text-slate-600"
                      >
                        <td className="py-2 px-4 pr-12 text-xs font-semibold text-slate-700">— إيجار مستحق</td>
                        <td className="py-2 px-4 text-left font-mono text-rose-600">{fmtC(stats.accR)}</td>
                        <td className="py-2 px-4 text-left font-mono text-slate-400">{pct(stats.accR, stats.income)}</td>
                      </tr>
                    )}
                    {stats.accO > 0 && (
                      <tr
                        onClick={() => setDetailModal({ isOpen: true, key: 'accrued:أخرى', label: 'مصروفات أخرى مستحقة' })}
                        className="hover:bg-amber-50/60 cursor-pointer text-slate-600"
                      >
                        <td className="py-2 px-4 pr-12 text-xs font-semibold text-slate-700">— مصروفات أخرى مستحقة</td>
                        <td className="py-2 px-4 text-left font-mono text-rose-600">{fmtC(stats.accO)}</td>
                        <td className="py-2 px-4 text-left font-mono text-slate-400">{pct(stats.accO, stats.income)}</td>
                      </tr>
                    )}
                  </>
                )}

                <tr
                  onClick={() => setDetailModal({ isOpen: true, key: 'opex', label: 'إجمالي المصروفات التشغيلية' })}
                  className="bg-slate-50 font-bold border-t border-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  <td className="py-2.5 px-4 text-slate-800 font-black">إجمالي المصروفات التشغيلية والمستحقة</td>
                  <td className="py-2.5 px-4 text-left font-mono font-black text-rose-700">{fmtC(stats.opex + stats.accrued)}</td>
                  <td className="py-2.5 px-4 text-left font-mono font-bold text-slate-700">{pct(stats.opex + stats.accrued, stats.income)}</td>
                </tr>

                {/* NET PROFIT / LOSS ROW */}
                <tr className="bg-slate-900 text-white font-black text-sm sm:text-base border-t-4 border-amber-400">
                  <td className="py-4 px-4 font-black">صافي الربح / (الخسارة) النهائي المعتمد</td>
                  <td className={`py-4 px-4 text-left font-mono font-black text-base sm:text-lg ${stats.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {stats.net < 0 ? `(${fmtC(Math.abs(stats.net))})` : fmtC(stats.net)}
                  </td>
                  <td className="py-4 px-4 text-left font-mono font-black text-amber-300">{pct(stats.net, stats.income)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SALES & REVENUES (تفاصيل المبيعات والإيرادات المحققة)               */}
      {/* ========================================================================= */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          {/* Executive KPIs Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
                <span>إجمالي المبيعات المحققة</span>
                <Wallet size={16} className="text-emerald-500" />
              </div>
              <div className="text-lg md:text-xl font-black font-mono text-emerald-600">
                {fmtC(stats.income)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                الفترة: {MONTH_AR[selMonth]} {selYear}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
                <span>عدد حركات المبيعات</span>
                <CheckCircle2 size={16} className="text-blue-500" />
              </div>
              <div className="text-lg md:text-xl font-black font-mono text-slate-800">
                {viewData.filter(r => r.Type === 'Income' && r.isExcluded === 0).length} حركة
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                معتمدة في قائمة الأرباح والخسائر
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
                <span>متوسط الحركة الواحدة</span>
                <TrendingUp size={16} className="text-indigo-500" />
              </div>
              <div className="text-lg md:text-xl font-black font-mono text-indigo-600">
                {(() => {
                  const incRows = viewData.filter(r => r.Type === 'Income' && r.isExcluded === 0);
                  const count = incRows.length;
                  return count > 0 ? fmtC(stats.income / count) : fmtC(0);
                })()}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                معدل الإيراد لكل عملية
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
                <span>الفرع النشط</span>
                <Building size={16} className="text-amber-500" />
              </div>
              <div className="text-sm md:text-base font-black text-slate-800 truncate">
                {selBranch === 'ALL' ? 'كافة الفروع (مجمّع)' : selBranch}
              </div>
              <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                حفظ فوري وسحابي دائم
              </div>
            </div>
          </div>

          {/* Quick Direct Sales Entry Card */}
          <div className="bg-gradient-to-l from-emerald-950 via-slate-900 to-indigo-950 rounded-2xl p-4 sm:p-5 text-white shadow-md border border-emerald-500/20">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white">تسجيل وتثبيت إيراد / مبيعات جديدة مباشرة</h3>
                  <p className="text-[11px] text-emerald-300">يتم حفظ وتثبيت الحركة فوراً في السيرفر وشيت جوجل وقاعدة البيانات دون فقدان</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenEditModal(-1, 'Income')}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-white/20 flex items-center gap-1"
              >
                <Plus size={13} />
                <span>إضافة عبر نافذة مفصلة</span>
              </button>
            </div>

            <form onSubmit={handleQuickAddSale} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs text-slate-900">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">التاريخ</label>
                  <input
                    type="date"
                    value={quickSaleDate}
                    onChange={e => setQuickSaleDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white rounded-xl font-bold border border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">الفرع</label>
                  <select
                    value={quickSaleBranch}
                    onChange={e => setQuickSaleBranch(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl font-bold border border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">{selBranch !== 'ALL' ? selBranch : (availableBranches[0] || 'الرئيسي')}</option>
                    {availableBranches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">الموظف / المحصل</label>
                  <select
                    value={quickSaleEmployee}
                    onChange={e => setQuickSaleEmployee(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl font-bold border border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">{availableEmployees[0] || 'كاشير الفرع الرئيسي'}</option>
                    {availableEmployees.map(e => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">نوع الإيراد / التصنيف</label>
                  <select
                    value={quickSaleCategory}
                    onChange={e => setQuickSaleCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl font-bold border border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="مبيعات">مبيعات نقدية</option>
                    <option value="مبيعات فرع">مبيعات فرع</option>
                    <option value="مبيعات نقاط بيع (POS)">مبيعات نقاط بيع (POS)</option>
                    <option value="إيراد خدمات">إيراد خدمات</option>
                    <option value="إيرادات تشغيلية">إيرادات تشغيلية</option>
                    <option value="إيرادات أخرى">إيرادات أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">المبلغ (د.ك)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="0.000"
                    value={quickSaleAmount}
                    onChange={e => setQuickSaleAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white rounded-xl font-mono font-black text-slate-900 border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">البيان / ملاحظات</label>
                  <input
                    type="text"
                    placeholder="مثال: مبيعات كاش فرع..."
                    value={quickSaleDesc}
                    onChange={e => setQuickSaleDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl font-bold text-slate-900 border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={quickSaleSubmitting}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  {quickSaleSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>جاري الحفظ والتثبيت...</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>حفظ وتثبيت الإيراد في النظام وشيت جوجل</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Sales Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet size={18} className="text-emerald-400" />
                <span className="font-extrabold text-sm sm:text-base">سجل تفاصيل المبيعات والإيرادات المحققة</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-bold">
                  {viewData.filter(r => r.Type === 'Income' && r.isExcluded === 0).length} حركة
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(-1, 'Income')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus size={13} />
                  <span>إضافة حركة إيراد</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-700 font-bold z-10">
                  <tr>
                    <th className="py-3 px-4 text-center w-12">#</th>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">البيان / العميل والتفاصيل</th>
                    <th className="py-3 px-4">الموظف / المحصل</th>
                    <th className="py-3 px-4">الفرع</th>
                    <th className="py-3 px-4">التصنيف</th>
                    <th className="py-3 px-4 text-left">المبلغ</th>
                    <th className="py-3 px-4 text-center w-24">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const incomeRows = viewData.filter(r => r.Type === 'Income' && r.isExcluded === 0);
                    if (incomeRows.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Wallet size={36} className="text-slate-300" />
                              <p className="font-bold text-sm text-slate-600">لا توجد حركات مبيعات أو إيرادات مسجلة لهذا الشهر حتى الآن</p>
                              <p className="text-xs text-slate-400">يمكنك تسجيل أول حركة مبيعات باستخدام نموذج الإدخال السريع أعلاه</p>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return incomeRows.map((r, i) => {
                      const idx = monthData.indexOf(r);
                      return (
                        <tr key={r._uid || i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 text-center font-mono text-slate-400 font-bold">{i + 1}</td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">{r.DateStr || '—'}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            <div>{r.Description || r.Category}</div>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-700">
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px]">
                              {r.Employee || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-700">
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-bold">
                              {r.Branch || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-700">
                            <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md text-[11px] font-bold">
                              {r.Category || 'مبيعات'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-left font-mono font-black text-emerald-600 text-sm whitespace-nowrap">
                            {fmtC(r.Amount)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(idx, 'Income')}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                title="تعديل الإيراد"
                              >
                                <PenSquare size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTransaction(r._uid)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                title="حذف الإيراد"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                {viewData.filter(r => r.Type === 'Income' && r.isExcluded === 0).length > 0 && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                    <tr>
                      <td colSpan={6} className="py-3 px-4 font-black text-slate-900 text-right">
                        إجمالي المبيعات والإيرادات المحققة في الفترة:
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-black text-emerald-700 text-base">
                        {fmtC(stats.income)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INVENTORY VALUATION & ACCRUALS (COGS + ACCRUED)                    */}
      {/* ========================================================================= */}
      {activeTab === 'inv' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inventory Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-black text-slate-900">
                <Boxes size={18} className="text-amber-500" />
                <span>تقييم المخزون وحساب تكلفة المبيعات (COGS)</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مخزون أول المدة (بداية الشهر)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={invOpening || ''}
                    onChange={e => setInvOpening(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black font-mono text-slate-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مشتريات الفترة (محسوبة دفترياً تلقائياً)</label>
                  <input
                    type="text"
                    readOnly
                    value={fmtC(stats.purchases)}
                    className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-black font-mono text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مخزون آخر المدة (الجرد الفعلي)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={invClosing || ''}
                    onChange={e => setInvClosing(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black font-mono text-slate-900 focus:bg-white"
                  />
                </div>
                <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-950 font-bold border border-amber-200">
                  معادلة المخزون: تكلفة البضاعة المباعة = مخزون أول ({fmt(stats.op)}) + المشتريات ({fmt(stats.purchases)}) − مخزون آخر ({fmt(stats.cl)}) = <strong>{fmtC(stats.cogs)}</strong>
                </div>
              </div>
            </div>

            {/* Accruals Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-black text-slate-900">
                <Calculator size={18} className="text-rose-500" />
                <span>ملخص المصروفات المستحقة (أساس الاستحقاق)</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 text-xs">
                  <span className="font-bold text-slate-700">رواتب مستحقة</span>
                  <strong className="font-mono text-rose-600 font-black">{fmtC(stats.accS)}</strong>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 text-xs">
                  <span className="font-bold text-slate-700">إيجار مستحق</span>
                  <strong className="font-mono text-rose-600 font-black">{fmtC(stats.accR)}</strong>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 text-xs">
                  <span className="font-bold text-slate-700">مصروفات أخرى مستحقة</span>
                  <strong className="font-mono text-rose-600 font-black">{fmtC(stats.accO)}</strong>
                </div>
                <div className="flex justify-between items-center pt-2 text-sm">
                  <span className="font-black text-slate-900">إجمالي الالتزامات المستحقة</span>
                  <strong className="font-mono text-rose-700 font-black text-base">{fmtC(stats.accrued)}</strong>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-950 font-medium border border-rose-200">
                  تُحمل على أرباح وخسائر الشهر فوراً لتحديد النتيجة الحقيقية للنشاط دون اشتراط السداد النقدي، وتوثق كالتزامات دائنة.
                </div>
              </div>
            </div>
          </div>

          {/* Add Accrual row form & table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-900 text-white font-bold text-sm flex items-center justify-between">
              <span>تفاصيل الرواتب والمصروفات المستحقة المضافة</span>
              <span className="text-xs text-slate-400">إجمالي: {accrualLines.length} بند</span>
            </div>
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">النوع</label>
                  <select
                    value={newAccType}
                    onChange={e => setNewAccType(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="رواتب">رواتب مستحقة</option>
                    <option value="إيجار">إيجار مستحق</option>
                    <option value="أخرى">مصروف مستحق آخر</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">الموظف / الجهة</label>
                  <input
                    type="text"
                    value={newAccEmp}
                    onChange={e => setNewAccEmp(e.target.value)}
                    placeholder="الاسم"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">الفرع</label>
                  <input
                    type="text"
                    value={newAccBranch}
                    onChange={e => setNewAccBranch(e.target.value)}
                    placeholder="الفرع"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">المبلغ</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newAccAmt}
                    onChange={e => setNewAccAmt(e.target.value)}
                    placeholder="0.000"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">البيان / الملاحظات</label>
                  <input
                    type="text"
                    value={newAccDesc}
                    onChange={e => setNewAccDesc(e.target.value)}
                    placeholder="مثال: راتب غير مدفوع"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleAddAccrual}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    إضافة بند
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">النوع</th>
                    <th className="py-2.5 px-4">الموظف / الجهة</th>
                    <th className="py-2.5 px-4">الفرع</th>
                    <th className="py-2.5 px-4">البيان والتفاصيل</th>
                    <th className="py-2.5 px-4 text-left">المبلغ</th>
                    <th className="py-2.5 px-4 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accrualLines.map((a, i) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-mono">{i + 1}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-200">
                          {a.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{a.employee || '—'}</td>
                      <td className="py-2.5 px-4 text-slate-700">{a.branch || '—'}</td>
                      <td className="py-2.5 px-4 text-slate-800">{a.description}</td>
                      <td className="py-2.5 px-4 text-left font-mono font-black text-rose-700">{fmtC(a.amount)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteAccrual(a.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TRANSFERS EXCLUDED FROM P&L                                        */}
      {/* ========================================================================= */}
      {activeTab === 'trans' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-amber-400" />
              <span className="font-extrabold text-sm sm:text-base">تحويلات العُهد والنقدية (مستبعدة نهائياً من P&L)</span>
            </div>
            <span className="text-xs bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-lg font-bold">
              عزل لمنع الازدواج المالي
            </span>
          </div>
          <div className="p-3 bg-amber-50/50 text-xs text-amber-950 font-bold border-b border-amber-100">
            جميع التحويلات بين الموظفين والفروع تُستبعد تلقائياً من قائمة الأرباح والخسائر، حتى لا تُحسب كإيراد أو مصروف مزدوج. وتظهر فقط في إيضاحات الصناديق.
          </div>
          <div className="overflow-x-auto max-h-[550px]">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">الموظف</th>
                  <th className="py-3 px-4">الفرع</th>
                  <th className="py-3 px-4">نوع التحويل</th>
                  <th className="py-3 px-4 text-left">المبلغ</th>
                  <th className="py-3 px-4">البيان</th>
                  <th className="py-3 px-4">سبب الاستبعاد المحاسبي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewData.filter(r => r.isExcluded === 1).map(r => (
                  <tr key={r._uid} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-500">{r.ID}</td>
                    <td className="py-2.5 px-4 font-mono">{r.DateStr || '—'}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">{r.Employee || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-700">{r.Branch || '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                        {r.Type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono font-bold text-slate-900">{fmtC(r.Amount)}</td>
                    <td className="py-2.5 px-4 text-slate-600">{r.Description}</td>
                    <td className="py-2.5 px-4 text-rose-600 font-bold flex items-center gap-1">
                      <Ban size={12} />
                      <span>تحويل عُهدة / تسوية نقدية</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: AUDIT LOG (ALL MOVEMENTS)                                          */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks size={18} className="text-blue-400" />
              <span className="font-extrabold text-sm sm:text-base">سجل الحركات — تعديل وتصنيف كامل</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  placeholder="بحث في الحركات..."
                  className="pr-8 pl-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs border border-slate-700 focus:outline-hidden w-48 sm:w-64"
                />
              </div>
              <button
                type="button"
                onClick={() => handleOpenEditModal(-1)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <Plus size={13} className="inline ml-1" />
                <span>إضافة حركة</span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[580px]">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">الفرع</th>
                  <th className="py-3 px-4">الموظف</th>
                  <th className="py-3 px-4">النوع</th>
                  <th className="py-3 px-4">التصنيف</th>
                  <th className="py-3 px-4 text-left">المبلغ</th>
                  <th className="py-3 px-4">البيان</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewData
                  .filter(r => {
                    if (!auditSearch.trim()) return true;
                    const q = auditSearch.trim().toLowerCase();
                    return `${r.Description} ${r.Category} ${r.Employee} ${r.Branch} ${r.Amount} ${r.Type}`.toLowerCase().includes(q);
                  })
                  .map(r => {
                    const idx = monthData.indexOf(r);
                    const isEx = r.isExcluded === 1;
                    return (
                      <tr key={r._uid} className={`hover:bg-slate-50 transition-colors ${isEx ? 'bg-amber-50/30' : ''}`}>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-500">{r.ID}</td>
                        <td className="py-2.5 px-4 font-mono whitespace-nowrap">{r.DateStr || '—'}</td>
                        <td className="py-2.5 px-4 text-slate-700">{r.Branch || '—'}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-800">{r.Employee || '—'}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-700">{r.Type}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{r.Category || '—'}</td>
                        <td className="py-2.5 px-4 text-left font-mono font-black text-slate-900">{fmtC(r.Amount)}</td>
                        <td className="py-2.5 px-4 text-slate-700 max-w-[280px] break-words">{r.Description || '—'}</td>
                        <td className="py-2.5 px-4 text-center">
                          {isEx ? (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">
                              مستبعد
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                              مُحتسب
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(idx)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                            title="تعديل"
                          >
                            <PenSquare size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleExclusion(r._uid)}
                            className="px-2 py-1 mx-1 text-[11px] font-bold border rounded-lg cursor-pointer hover:bg-slate-100"
                            title="تبديل الاحتساب"
                          >
                            {isEx ? 'تفعيل' : 'استبعاد'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(r._uid)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: BULK RECLASSIFICATION                                              */}
      {/* ========================================================================= */}
      {activeTab === 'classify' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-black text-slate-900 text-base">
            <Tags size={18} className="text-blue-600" />
            <span>إعادة التصنيف المحاسبي الجماعي</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف الحالي</label>
              <select
                value={clsFrom}
                onChange={e => setClsFrom(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
              >
                <option value="">— اختر التصنيف المراد تغييره —</option>
                {availableCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف الجديد المقترح</label>
              <select
                value={clsTo}
                onChange={e => setClsTo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
              >
                <option value="">— اختر تصنيف قائم —</option>
                {availableCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__new__">— كتابة تصنيف جديد —</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">أو اكتب اسماً لتصنيف جديد</label>
              <input
                type="text"
                value={clsNew}
                onChange={e => setClsNew(e.target.value)}
                placeholder="اسم التصنيف الجديد"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
              />
            </div>

            <div className="md:col-span-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleApplyClassify}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
              >
                <Check size={14} className="inline ml-1" />
                <span>تطبيق على كافة الحركات المعروضة بالفترة</span>
              </button>
              <span className="text-xs text-slate-500">يُطبق على الفترة والفرع المحددين فقط دون المساس ببيانات الفترات الأخرى.</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">خريطة التصنيفات المحاسبية المعتمدة</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 font-bold">
                <span className="block font-black text-emerald-800 mb-1">إيرادات ومبيعات:</span>
                مبيعات، مقبوضات عامة، إيرادات تشغيلية، مرتجعات مشتريات
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 font-bold">
                <span className="block font-black text-amber-800 mb-1">تكلفة البضاعة المباعة (COGS):</span>
                مشتريات بضاعة، مشتريات آجلة، مواد خام وتغليف
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 font-bold">
                <span className="block font-black text-rose-800 mb-1">مصروفات تشغيلية (OPEX):</span>
                رواتب، إيجار، نثريات، كهرباء، صيانة، تسويق، رسوم
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: CASH & FUND LEDGERS (إيضاحات الصناديق)                             */}
      {/* ========================================================================= */}
      {activeTab === 'funds' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-black text-slate-900 text-base">
              <Wallet size={18} className="text-blue-600" />
              <span>إيضاحات الصناديق — مقبوضات · مدفوعات · تحويلات</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed font-bold">
              <strong>القاعدة المحاسبية الحاكمة:</strong> التحويلات بين الموظفين والفروع تظهر هنا في كشوف الصناديق لتتبع العهد وحركتها، لكنها لا تدخل إطلاقاً في قائمة الأرباح والخسائر لأنها مقابل تغذية عهدة أو نقل سيولة. ما يدخل قائمة P&L فقط: المقبوضات والإيرادات والمصروفات الحقيقية.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عرض كشف حساب الصندوق</label>
                <select
                  value={fundSelect}
                  onChange={e => setFundSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value="ALL">جميع الصناديق (مجمّع)</option>
                  {fundsList.map(f => (
                    <option key={f.name} value={f.name}>{f.name} ({f.count} حركة)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تجميع حسب</label>
                <select
                  value={fundGroupBy}
                  onChange={e => setFundGroupBy(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value="employee">الموظف / الصندوق</option>
                  <option value="branch">الفرع</option>
                  <option value="emp_branch">الموظف + الفرع</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintFundLedger}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={14} />
                  <span>طباعة الكشف المعتمد (كامل)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Summary table of all funds */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-900 text-white font-bold text-sm flex items-center justify-between">
              <span>ملخص الصناديق (يشمل التحويلات للتدقيق والمطابقة)</span>
              <span className="text-xs text-slate-400">إجمالي {fundsList.length} صندوق</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="py-3 px-4">الصندوق</th>
                    <th className="py-3 px-4 text-left">رصيد أول</th>
                    <th className="py-3 px-4 text-left text-emerald-700">مقبوضات</th>
                    <th className="py-3 px-4 text-left text-rose-700">مدفوعات</th>
                    <th className="py-3 px-4 text-left text-blue-700">تحويل وارد</th>
                    <th className="py-3 px-4 text-left text-amber-700">تحويل صادر</th>
                    <th className="py-3 px-4 text-left">صافي يخص P&L</th>
                    <th className="py-3 px-4 text-left">رصيد آخر</th>
                    <th className="py-3 px-4 text-center">الحركات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fundsList.map(f => {
                    const netPL = f.receipts - f.payments;
                    return (
                      <tr
                        key={f.name}
                        onClick={() => setFundSelect(f.name)}
                        className={`hover:bg-blue-50/60 cursor-pointer transition-colors ${fundSelect === f.name ? 'bg-blue-50/80 font-bold' : ''}`}
                      >
                        <td className="py-2.5 px-4 font-bold text-slate-900">{f.name}</td>
                        <td className="py-2.5 px-4 text-left font-mono font-bold text-slate-800">{fmtC(f.opening)}</td>
                        <td className="py-2.5 px-4 text-left font-mono font-bold text-emerald-700">{fmtC(f.receipts)}</td>
                        <td className="py-2.5 px-4 text-left font-mono font-bold text-rose-700">{fmtC(f.payments)}</td>
                        <td className="py-2.5 px-4 text-left font-mono font-bold text-blue-700">{fmtC(f.tin)}</td>
                        <td className="py-2.5 px-4 text-left font-mono font-bold text-amber-700">{fmtC(f.tout)}</td>
                        <td className={`py-2.5 px-4 text-left font-mono font-black ${netPL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtC(netPL)}</td>
                        <td className="py-2.5 px-4 text-left font-mono font-black text-slate-900">{fmtC(f.closing)}</td>
                        <td className="py-2.5 px-4 text-center font-mono">{f.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Full ledger of current fund */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-900 text-white font-bold text-sm flex items-center justify-between">
              <span>كشف حساب: {fundSelect === 'ALL' ? 'جميع الصناديق' : fundSelect} — كامل دون اختصار</span>
              <button
                type="button"
                onClick={handlePrintFundLedger}
                className="px-3 py-1 bg-amber-400 text-slate-950 rounded-lg text-xs font-black cursor-pointer"
              >
                طباعة الكشف
              </button>
            </div>
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="py-3 px-3 text-center">#</th>
                    <th className="py-3 px-3">التاريخ</th>
                    <th className="py-3 px-3">الموظف</th>
                    <th className="py-3 px-3">الفرع</th>
                    <th className="py-3 px-3">النوع</th>
                    <th className="py-3 px-3">التصنيف</th>
                    <th className="py-3 px-3 w-1/3 min-w-[260px]">البيان والتفاصيل (كامل)</th>
                    <th className="py-3 px-3 text-left">مدين</th>
                    <th className="py-3 px-3 text-left">دائن</th>
                    <th className="py-3 px-3 text-left">الرصيد التراكمي</th>
                    <th className="py-3 px-3 text-center">الحالة في P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Opening Balance Row */}
                  <tr className="bg-amber-50/60 font-bold border-b border-amber-200">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">—</td>
                    <td className="py-2.5 px-3 font-mono">{periodBounds.start.toLocaleDateString('en-CA')}</td>
                    <td colSpan={2} className="py-2.5 px-3">{fundSelect === 'ALL' ? 'جميع الصناديق' : fundSelect}</td>
                    <td className="py-2.5 px-3"><span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-black">رصيد سابق</span></td>
                    <td className="py-2.5 px-3">افتتاحي</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">الرصيد الافتتاحي المرحل لما قبل بداية الفترة</td>
                    <td className="py-2.5 px-3 text-left font-mono">{currentFundLedger.opening < 0 ? fmtC(Math.abs(currentFundLedger.opening)) : ''}</td>
                    <td className="py-2.5 px-3 text-left font-mono">{currentFundLedger.opening >= 0 ? fmtC(currentFundLedger.opening) : ''}</td>
                    <td className="py-2.5 px-3 text-left font-mono font-black text-slate-900">{fmtC(currentFundLedger.opening)}</td>
                    <td className="py-2.5 px-3 text-center"><span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-bold">رصيد سابق</span></td>
                  </tr>

                  {/* Period Transactions */}
                  {(() => {
                    let running = currentFundLedger.opening;
                    return currentFundLedger.periodRows.map((r, i) => {
                      const amt = r.Amount || 0;
                      const isIn = r.Type === 'Income' || r.Type === 'Transfer-In';
                      const isOut = r.Type === 'Expense' || r.Type === 'Transfer-Out';
                      let debit = 0, credit = 0;
                      if (isOut) { debit = amt; running -= amt; }
                      else if (isIn) { credit = amt; running += amt; }
                      else { debit = amt; running -= amt; }

                      const isT = r.Type === 'Transfer-In' || r.Type === 'Transfer-Out';
                      const isEx = isT || r.isExcluded === 1;

                      return (
                        <tr key={r._uid} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">{i + 1}</td>
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap">{r.DateStr || '—'}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{r.Employee || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-700">{r.Branch || '—'}</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-bold">{r.Type}</span></td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{r.Category || '—'}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-950 break-words leading-relaxed">{r.Description || '—'}</td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-rose-600">{debit ? fmtC(debit) : ''}</td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-600">{credit ? fmtC(credit) : ''}</td>
                          <td className="py-2.5 px-3 text-left font-mono font-black text-slate-900">{fmtC(running)}</td>
                          <td className="py-2.5 px-3 text-center">
                            {isEx ? (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[10px] font-bold border border-rose-200">مستبعد</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200">محتسب</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT / ADD TRANSACTION                                             */}
      {/* ========================================================================= */}
      {editModalData?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-black text-slate-900 text-base">
                {editModalData.idx >= 0 ? `تعديل حركة #${editModalData.idx + 1}` : 'إضافة حركة جديدة'}
              </h3>
              <button
                type="button"
                onClick={() => setEditModalData(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">التاريخ</label>
                <input
                  type="date"
                  value={editModalData.DateStr}
                  onChange={e => setEditModalData({ ...editModalData, DateStr: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الفرع</label>
                <select
                  value={editModalData.Branch}
                  onChange={e => setEditModalData({ ...editModalData, Branch: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  {availableBranches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الموظف / المحصل</label>
                <select
                  value={editModalData.Employee}
                  onChange={e => setEditModalData({ ...editModalData, Employee: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  {availableEmployees.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع الحركة</label>
                <select
                  value={editModalData.Type}
                  onChange={e => setEditModalData({ ...editModalData, Type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="Income">إيراد / مبيعات (Income)</option>
                  <option value="Expense">مصروف (Expense)</option>
                  <option value="Transfer-Out">تحويل صادر</option>
                  <option value="Transfer-In">تحويل وارد</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">التصنيف</label>
                <input
                  type="text"
                  list="modal-categories-list"
                  value={editModalData.Category}
                  onChange={e => setEditModalData({ ...editModalData, Category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                />
                <datalist id="modal-categories-list">
                  <option value="مبيعات" />
                  <option value="مبيعات نقدية" />
                  <option value="مبيعات نقاط بيع (POS)" />
                  <option value="إيراد خدمات" />
                  <option value="إيرادات تشغيلية" />
                  <option value="مشتريات" />
                  <option value="رواتب" />
                  <option value="إيجار" />
                  <option value="نثريات" />
                </datalist>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المبلغ (د.ك)</label>
                <input
                  type="number"
                  step="0.001"
                  value={editModalData.Amount}
                  onChange={e => setEditModalData({ ...editModalData, Amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-rose-700 mb-1">حالة الاحتساب في قائمة الأرباح والخسائر</label>
                <select
                  value={editModalData.isExcluded}
                  onChange={e => setEditModalData({ ...editModalData, isExcluded: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="0">مُحتسب في قائمة الأرباح والخسائر</option>
                  <option value="1">مستبعد نهائياً (تحويل عهدة / تسوية)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">البيان والتفاصيل</label>
                <textarea
                  rows={2}
                  value={editModalData.Description}
                  onChange={e => setEditModalData({ ...editModalData, Description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditModalData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveModalRow}
                disabled={savingRow}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {savingRow && <Loader2 size={14} className="animate-spin" />}
                <span>{savingRow ? 'جاري الحفظ والتثبيت...' : 'حفظ وتثبيت الحركة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ITEM DRILLDOWN DETAILS                                              */}
      {/* ========================================================================= */}
      {detailModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">{detailModal.label}</h3>
                <span className="text-xs text-slate-500 font-bold">
                  {getDetailRows(detailModal.key).length} حركة مسجلة · الإجمالي:{' '}
                  {fmtC(getDetailRows(detailModal.key).reduce((s, r) => s + (r.Amount || 0), 0))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-x-auto flex-1 max-h-[500px]">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">التاريخ</th>
                    <th className="py-2.5 px-3">البيان</th>
                    <th className="py-2.5 px-3">الموظف</th>
                    <th className="py-2.5 px-3">الفرع</th>
                    <th className="py-2.5 px-3">التصنيف</th>
                    <th className="py-2.5 px-3 text-left">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {getDetailRows(detailModal.key).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-slate-500">{i + 1}</td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">{r.DateStr || '—'}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{r.Description || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-700">{r.Employee || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-700">{r.Branch || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-700">{r.Category || '—'}</td>
                      <td className="py-2.5 px-3 text-left font-mono font-black text-slate-900">{fmtC(r.Amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-600">
                إجمالي قيمة البند المعتمدة:{' '}
                <strong className="text-emerald-700 font-mono text-sm">
                  {fmtC(getDetailRows(detailModal.key).reduce((s, r) => s + (r.Amount || 0), 0))}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
