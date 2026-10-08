import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { transactionSchema, employeeSchema, orderSchema } from './server/validation';
import { auditService } from './server/audit';
import { performReconciliation } from './server/reconciliation';
import { toFils, toKWD, normalizeEntityId } from './src/utils/money';
import { normalizeExcelDate, calculateRowCashFlow, isAccrualType } from './src/utils/format';
import { getSupabaseServerClient } from './server/supabase';

const app = express();
const PORT = 3000;

// Body Parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// CORS & Headers for internal API routes
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// In-Memory & File-backed Store for persistent system state
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const STORE_FILE = path.join(DATA_DIR, 'financial_store.json');

interface BranchItem {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
}

interface CategoryItem {
  id: string;
  categoryId: string;
  name: string;
  parentCategory?: string;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
}

interface VendorItem {
  id: string;
  vendorId: string;
  name: string;
  contactInfo?: string;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
}

interface EmployeeItem {
  id: string;
  employeeId: string;
  name: string;
  role?: string;
  isActive: boolean;
  balance?: number;
  notes?: string;
  createdAt?: string;
}

interface ServerStore {
  transactions: any[];
  orders: any[];
  budgets: any[];
  settlements: any[];
  employees: { name: string; balance: number }[];
  branches: string[];
  categories: string[];
  // Structured Centralized Settings
  settingsBranches?: BranchItem[];
  settingsCategories?: CategoryItem[];
  settingsVendors?: VendorItem[];
  settingsEmployees?: EmployeeItem[];
  lastSync: string;
}

function loadStore(): ServerStore {
  const defaultStore: ServerStore = {
    transactions: [],
    orders: [],
    budgets: [],
    settlements: [],
    employees: [
      { name: 'بيتر ناصر', balance: 0 },
      { name: 'محمد جابر', balance: 0 },
      { name: 'كاشير الفرع الرئيسي', balance: 0 },
      { name: 'مسؤول المشتريات', balance: 0 }
    ],
    branches: ['الورده الانيقة', 'تعبئة وتغليف', 'الرئيسي', 'المصنع', 'المستودع', 'فرع حولي'],
    categories: ['مشتريات', 'رواتب', 'إيجار', 'ضيافة وبوفيه', 'نثريات', 'صيانة', 'تحويل عهدة نقدية', 'خدمات حكومية'],
    lastSync: new Date().toISOString()
  };

  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(data);

      const baseBranches = Array.isArray(parsed.branches) && parsed.branches.length > 0 ? parsed.branches : defaultStore.branches;
      const baseCategories = Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : defaultStore.categories;
      const baseEmployees = Array.isArray(parsed.employees) && parsed.employees.length > 0 ? parsed.employees : defaultStore.employees;

      // Safe non-destructive derivation of structured settings
      const settingsBranches: BranchItem[] = Array.isArray(parsed.settingsBranches) && parsed.settingsBranches.length > 0
        ? parsed.settingsBranches
        : baseBranches.map((bName: string, idx: number) => ({
            id: `BR-${String(idx + 1).padStart(3, '0')}`,
            branchId: `BR-${String(idx + 1).padStart(3, '0')}`,
            name: bName,
            isActive: true,
            createdAt: new Date().toISOString()
          }));

      const settingsCategories: CategoryItem[] = Array.isArray(parsed.settingsCategories) && parsed.settingsCategories.length > 0
        ? parsed.settingsCategories
        : baseCategories.map((cName: string, idx: number) => {
            let parent = 'تشغيلي';
            if (cName.includes('رواتب') || cName.includes('إداري')) parent = 'إداري';
            else if (cName.includes('إيجار')) parent = 'ثابت';
            else if (cName.includes('مبيعات') || cName.includes('إيراد')) parent = 'إيرادات';
            else if (cName.includes('سداد') || cName.includes('التزام') || cName.includes('آجل')) parent = 'التزامات';
            else if (cName.includes('ضيافة') || cName.includes('نثريات')) parent = 'عمومية';
            return {
              id: `CAT-${String(idx + 1).padStart(3, '0')}`,
              categoryId: `CAT-${String(idx + 1).padStart(3, '0')}`,
              name: cName,
              parentCategory: parent,
              isActive: true,
              createdAt: new Date().toISOString()
            };
          });

      const defaultVendors: VendorItem[] = [
        { id: 'VEN-001', vendorId: 'VEN-001', name: 'شركة المواد الغذائية المتحدة', contactInfo: '22450000', isActive: true },
        { id: 'VEN-002', vendorId: 'VEN-002', name: 'مؤسسة التغليف الحديثة', contactInfo: '24810000', isActive: true },
        { id: 'VEN-003', vendorId: 'VEN-003', name: 'مطبعة النور الكويتية', contactInfo: '99887766', isActive: true },
        { id: 'VEN-004', vendorId: 'VEN-004', name: 'المؤجر العقاري', contactInfo: '55443322', isActive: true }
      ];

      const settingsVendors: VendorItem[] = Array.isArray(parsed.settingsVendors) && parsed.settingsVendors.length > 0
        ? parsed.settingsVendors
        : defaultVendors;

      const settingsEmployees: EmployeeItem[] = Array.isArray(parsed.settingsEmployees) && parsed.settingsEmployees.length > 0
        ? parsed.settingsEmployees
        : baseEmployees.map((e: any, idx: number) => ({
            id: `EMP-${String(idx + 1).padStart(3, '0')}`,
            employeeId: `EMP-${String(idx + 1).padStart(3, '0')}`,
            name: e.name,
            role: e.name.includes('كاشير') ? 'كاشير مبيعات' : e.name.includes('مشتريات') ? 'مسؤول مشتريات' : 'أمين عهدة / محاسب',
            isActive: true,
            balance: e.balance || 0,
            createdAt: new Date().toISOString()
          }));

      return {
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
        settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
        employees: baseEmployees,
        branches: baseBranches,
        categories: baseCategories,
        settingsBranches,
        settingsCategories,
        settingsVendors,
        settingsEmployees,
        lastSync: parsed.lastSync || defaultStore.lastSync
      };
    }
  } catch (err) {
    console.warn('Could not read store file, using initial defaults:', err);
  }
  return defaultStore;
}

function saveStore(store: ServerStore) {
  try {
    store.lastSync = new Date().toISOString();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store file:', err);
  }
}

let serverStore = loadStore();

// Lazy-initialized Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Single Source of Truth: Authoritative balance recalculator using integer fils (1 KWD = 1000 fils)
function recalculateAuthoritativeBalances() {
  const balancesFilsMap = new Map<string, number>();

  // Ensure all known employees have a starting entry
  serverStore.employees.forEach(e => {
    balancesFilsMap.set(e.name.trim(), 0);
  });

  // Chronological sort
  const sortedTx = [...serverStore.transactions].sort((a, b) => {
    const tA = new Date(normalizeExcelDate(a.date)).getTime() || 0;
    const tB = new Date(normalizeExcelDate(b.date)).getTime() || 0;
    if (tA !== tB) return tA - tB;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  sortedTx.forEach(t => {
    const emp = (t.employee || '').trim();
    if (!emp) return;

    let targetKey = emp;
    for (const key of balancesFilsMap.keys()) {
      if (key.toLowerCase() === emp.toLowerCase()) {
        targetKey = key;
        break;
      }
    }

    const currentFils = balancesFilsMap.get(targetKey) || 0;
    const flow = calculateRowCashFlow(t);
    balancesFilsMap.set(targetKey, currentFils + flow.netCashFils);
  });

  serverStore.employees.forEach(e => {
    const fils = balancesFilsMap.get(e.name.trim()) || 0;
    e.balance = fils / 1000;
  });
}

// Unified API Response Formatter
function sendError(res: express.Response, error: string, statusCode = 400, details?: any) {
  return res.status(statusCode).json({
    success: false,
    error,
    details,
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}

// Run initial balance calculation on boot to guarantee truth
recalculateAuthoritativeBalances();

// ----------------------------------------------------
// BACKEND API ENDPOINTS
// ----------------------------------------------------

// 1. Health & Server Status
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    storage: {
      transactionsCount: serverStore.transactions.length,
      ordersCount: serverStore.orders.length,
      employeesCount: serverStore.employees.length
    }
  });
});

// 2. Centralized Settings (Branches, Categories, Vendors, Employees)
app.get('/api/settings', (_req, res) => {
  // Return backward compatible arrays as well as full structured tables
  const activeBranches = (serverStore.settingsBranches || []).filter(b => b.isActive).map(b => b.name);
  const activeCategories = (serverStore.settingsCategories || []).filter(c => c.isActive).map(c => c.name);
  const activeVendors = (serverStore.settingsVendors || []).filter(v => v.isActive).map(v => v.name);
  const activeEmployees = (serverStore.settingsEmployees || []).filter(e => e.isActive).map(e => e.name);

  res.json({
    success: true,
    branches: activeBranches.length > 0 ? activeBranches : serverStore.branches,
    categories: activeCategories.length > 0 ? activeCategories : serverStore.categories,
    vendors: activeVendors,
    employees: activeEmployees,
    settings: {
      branches: serverStore.settingsBranches || [],
      categories: serverStore.settingsCategories || [],
      vendors: serverStore.settingsVendors || [],
      employees: serverStore.settingsEmployees || []
    }
  });
});

app.post('/api/settings', (req, res) => {
  const { branches, categories, vendors, employees, settings } = req.body;

  // 1. Structured settings object update
  if (settings && typeof settings === 'object') {
    if (Array.isArray(settings.branches)) {
      serverStore.settingsBranches = settings.branches;
      serverStore.branches = settings.branches.map((b: any) => typeof b === 'string' ? b : b.name);
    }
    if (Array.isArray(settings.categories)) {
      serverStore.settingsCategories = settings.categories;
      serverStore.categories = settings.categories.map((c: any) => typeof c === 'string' ? c : c.name);
    }
    if (Array.isArray(settings.vendors)) {
      serverStore.settingsVendors = settings.vendors;
    }
    if (Array.isArray(settings.employees)) {
      serverStore.settingsEmployees = settings.employees;
    }
  }

  // 2. Direct array updates
  if (Array.isArray(branches)) {
    if (branches.length > 0 && typeof branches[0] === 'object') {
      serverStore.settingsBranches = branches;
      serverStore.branches = branches.map((b: any) => b.name);
    } else {
      serverStore.branches = branches;
      serverStore.settingsBranches = branches.map((b: string, i: number) => ({
        id: `BR-${String(i + 1).padStart(3, '0')}`,
        branchId: `BR-${String(i + 1).padStart(3, '0')}`,
        name: b,
        isActive: true,
        createdAt: new Date().toISOString()
      }));
    }
  }

  if (Array.isArray(categories)) {
    if (categories.length > 0 && typeof categories[0] === 'object') {
      serverStore.settingsCategories = categories;
      serverStore.categories = categories.map((c: any) => c.name);
    } else {
      serverStore.categories = categories;
      serverStore.settingsCategories = categories.map((c: string, i: number) => ({
        id: `CAT-${String(i + 1).padStart(3, '0')}`,
        categoryId: `CAT-${String(i + 1).padStart(3, '0')}`,
        name: c,
        parentCategory: 'عام',
        isActive: true,
        createdAt: new Date().toISOString()
      }));
    }
  }

  if (Array.isArray(vendors)) {
    serverStore.settingsVendors = vendors;
  }

  if (Array.isArray(employees)) {
    serverStore.settingsEmployees = employees;
  }

  saveStore(serverStore);

  auditService.log({
    action: 'UPDATE',
    entityType: 'SETTINGS',
    entityId: 'SYSTEM_SETTINGS',
    actor: req.body.actor || 'مدير النظام',
    description: 'تحديث جداول الإعدادات المركزية (الفروع، التصنيفات، الموردين، الموظفين)'
  });

  res.json({
    success: true,
    message: 'تم حفظ وتحديث الإعدادات بنجاح',
    branches: serverStore.branches,
    categories: serverStore.categories,
    settings: {
      branches: serverStore.settingsBranches,
      categories: serverStore.settingsCategories,
      vendors: serverStore.settingsVendors,
      employees: serverStore.settingsEmployees
    }
  });
});

// Referential Integrity Checker: Pre-flight check before deleting an entity
app.post('/api/settings/check-delete', (req, res) => {
  const { type, name, id } = req.body;
  if (!name && !id) {
    return res.status(400).json({ success: false, error: 'الاسم أو المعرف مطلوب للتحقق' });
  }

  const targetName = String(name || '').trim().toLowerCase();
  let matchedTransactions: any[] = [];

  if (type === 'branch') {
    matchedTransactions = serverStore.transactions.filter(t => 
      String(t.branch || '').trim().toLowerCase() === targetName
    );
  } else if (type === 'category') {
    matchedTransactions = serverStore.transactions.filter(t => 
      String(t.category || '').trim().toLowerCase() === targetName ||
      String(t.category || '').trim().toLowerCase().includes(targetName)
    );
  } else if (type === 'vendor') {
    matchedTransactions = serverStore.transactions.filter(t => 
      String(t.vendorName || '').trim().toLowerCase() === targetName ||
      String(t.description || '').trim().toLowerCase().includes(targetName)
    );
  } else if (type === 'employee') {
    matchedTransactions = serverStore.transactions.filter(t => 
      String(t.employee || '').trim().toLowerCase() === targetName ||
      String(t.sender || '').trim().toLowerCase() === targetName ||
      String(t.receiver || '').trim().toLowerCase() === targetName
    );
  }

  const linkedCount = matchedTransactions.length;
  const canDelete = linkedCount === 0;

  res.json({
    success: true,
    canDelete,
    linkedCount,
    type,
    name,
    sampleTransactions: matchedTransactions.slice(0, 5).map(t => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      type: t.type,
      description: t.description
    })),
    reason: canDelete 
      ? 'لا توجد أي معاملات مالية مسجلة مرتبطة بهذا البند، يمكن حذفه بأمان تام.'
      : `لا يمكن حذف هذا البند لارتباطه بـ (${linkedCount}) حركة مالية مسجلة في شيت المعاملات. لحماية سلامة السجلات التاريخية، يُرجى تعطيله (تحويله إلى غير نشط) بدلاً من حذفه.`
  });
});

// Delete or Soft-Delete Setting Item
app.delete('/api/settings/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const { forceSoftDelete } = req.body || {};

  let listKey: 'settingsBranches' | 'settingsCategories' | 'settingsVendors' | 'settingsEmployees' | null = null;
  let nameKey = 'name';

  if (type === 'branch') listKey = 'settingsBranches';
  else if (type === 'category') listKey = 'settingsCategories';
  else if (type === 'vendor') listKey = 'settingsVendors';
  else if (type === 'employee') listKey = 'settingsEmployees';

  if (!listKey || !serverStore[listKey]) {
    return res.status(400).json({ success: false, error: 'نوع الإعداد المطلوب غير معروف' });
  }

  const list: any[] = serverStore[listKey] || [];
  const itemIndex = list.findIndex(item => item.id === id || item[`${type}Id`] === id || item.name === id);

  if (itemIndex === -1) {
    return res.status(404).json({ success: false, error: 'العنصر المطلوب غير موجود في الإعدادات' });
  }

  const targetItem = list[itemIndex];
  const targetName = String(targetItem[nameKey] || '').trim().toLowerCase();

  // Referential integrity check
  let linkedCount = 0;
  if (type === 'branch') {
    linkedCount = serverStore.transactions.filter(t => String(t.branch || '').trim().toLowerCase() === targetName).length;
  } else if (type === 'category') {
    linkedCount = serverStore.transactions.filter(t => String(t.category || '').trim().toLowerCase() === targetName).length;
  } else if (type === 'vendor') {
    linkedCount = serverStore.transactions.filter(t => String(t.vendorName || '').trim().toLowerCase() === targetName).length;
  } else if (type === 'employee') {
    linkedCount = serverStore.transactions.filter(t => String(t.employee || '').trim().toLowerCase() === targetName).length;
  }

  if (linkedCount > 0 && !forceSoftDelete) {
    return res.status(400).json({
      success: false,
      canDelete: false,
      linkedCount,
      error: `لا يمكن حذف (${targetItem.name}) لوجود ${linkedCount} معاملة مالية مرتبطة به. يرجى تعطيله بدلاً من حذفه.`
    });
  }

  if (linkedCount > 0 || forceSoftDelete) {
    // Soft Delete (Deactivate)
    targetItem.isActive = false;
    saveStore(serverStore);
    return res.json({
      success: true,
      softDeleted: true,
      message: `تم تحويل (${targetItem.name}) إلى غير نشط لحفظ السجلات التاريخية.`
    });
  }

  // Hard Delete if 0 linked transactions
  list.splice(itemIndex, 1);

  if (type === 'branch') {
    serverStore.branches = (serverStore.settingsBranches || []).map(b => b.name);
  } else if (type === 'category') {
    serverStore.categories = (serverStore.settingsCategories || []).map(c => c.name);
  }

  saveStore(serverStore);

  auditService.log({
    action: 'DELETE',
    entityType: 'SETTINGS',
    entityId: id,
    actor: 'مدير النظام',
    description: `حذف (${targetItem.name}) من إعدادات ${type} بأمان لعدم ارتباطه بأي معاملات`
  });

  res.json({
    success: true,
    hardDeleted: true,
    message: `تم حذف (${targetItem.name}) نهائياً لعدم وجود أي ارتباطات محاسبية به.`
  });
});

// 3. Transactions CRUD & Reporting
app.get('/api/transactions', (req, res) => {
  const { branch, employee, category, department, startDate, endDate } = req.query;
  let list = [...serverStore.transactions];

  const isAll = (v: any) => !v || v === 'all' || v === 'All' || v === 'الكل' || v === 'كافة الفروع' || v === 'كل الفروع';

  if (!isAll(branch)) {
    list = list.filter(t => t.branch === branch);
  }
  if (!isAll(employee)) {
    const empQuery = String(employee).trim().toLowerCase();
    list = list.filter(t => (t.employee || '').trim().toLowerCase() === empQuery);
  }
  if (!isAll(category)) {
    list = list.filter(t => t.category === category);
  }
  const isCityBranch = !isAll(branch) && (String(branch).trim() === 'سيتي' || String(branch).includes('سيتي'));
  if (isCityBranch && department && department !== 'All' && department !== 'الكل' && department !== '') {
    if (department === 'unassigned' || department === 'غير محدد / بيانات سابقة' || department === 'none') {
      list = list.filter(t => !t.department || String(t.department).trim() === '');
    } else {
      list = list.filter(t => t.department === department);
    }
  }
  if (startDate) {
    const normStart = normalizeExcelDate(startDate);
    if (normStart) {
      list = list.filter(t => normalizeExcelDate(t.date) >= normStart);
    }
  }
  if (endDate) {
    const normEnd = normalizeExcelDate(endDate);
    if (normEnd) {
      list = list.filter(t => normalizeExcelDate(t.date) <= normEnd);
    }
  }

  // Sort chronologically
  list.sort((a, b) => {
    const tA = new Date(normalizeExcelDate(a.date)).getTime() || 0;
    const tB = new Date(normalizeExcelDate(b.date)).getTime() || 0;
    if (tA !== tB) return tA - tB;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  let openingFils = 0;
  if (startDate) {
    const normStart = normalizeExcelDate(startDate);
    if (normStart) {
      let priorList = [...serverStore.transactions];
      if (!isAll(branch)) priorList = priorList.filter(t => t.branch === branch);
      if (!isAll(employee)) {
        const empQuery = String(employee).trim().toLowerCase();
        priorList = priorList.filter(t => (t.employee || '').trim().toLowerCase() === empQuery);
      }
      priorList = priorList.filter(t => normalizeExcelDate(t.date) < normStart);
      priorList.forEach(t => {
        const flow = calculateRowCashFlow(t);
        openingFils += flow.netCashFils;
      });
    }
  }

  res.json({
    success: true,
    total: list.length,
    rows: list,
    openingBalance: toKWD(openingFils)
  });
});

app.post('/api/transactions', (req, res) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, parsed.error.issues[0]?.message || 'بيانات المعاملة غير صحيحة', 400, parsed.error.issues);
  }

  const data = parsed.data;
  const newId = Date.now().toString();
  const amountFils = toFils(data.amount);
  const amountKwd = toKWD(amountFils);

  // Strict enforcement: department ONLY allowed for branch 'سيتي'
  const isCityBranch = (data.branch || '').trim() === 'سيتي';
  const assignedDepartment = isCityBranch && data.department ? data.department.trim() : null;

  // Check for custody transfer between two employees
  if (data.type === 'Transfer' && data.sender && data.receiver && data.sender.trim() !== data.receiver.trim()) {
    const senderName = data.sender.trim();
    const receiverName = data.receiver.trim();

    // 1. Transaction for sender (Outflow / -)
    const senderTx = {
      id: newId,
      rowId: newId,
      date: normalizeExcelDate(data.date) || new Date().toISOString().split('T')[0],
      employee: senderName,
      branch: data.branch || 'الرئيسي',
      department: assignedDepartment,
      category: `تحويل عهدة (صادر إلى ${receiverName})`,
      description: data.description || `تحويل عهدة نقدية من ${senderName} إلى ${receiverName}`,
      amount: amountKwd,
      amountFils,
      type: 'Transfer-Out',
      sender: senderName,
      receiver: receiverName,
      targetMonth: data.targetMonth,
      createdAt: new Date().toISOString()
    };

    // 2. Transaction for receiver (Inflow / +)
    const receiverId = (Date.now() + 1).toString();
    const receiverTx = {
      id: receiverId,
      rowId: receiverId,
      date: normalizeExcelDate(data.date) || new Date().toISOString().split('T')[0],
      employee: receiverName,
      branch: data.branch || 'الرئيسي',
      department: assignedDepartment,
      category: `تحويل عهدة (وارد من ${senderName})`,
      description: data.description || `تحويل عهدة نقدية من ${senderName} إلى ${receiverName}`,
      amount: amountKwd,
      amountFils,
      type: 'Transfer-In',
      sender: senderName,
      receiver: receiverName,
      targetMonth: data.targetMonth,
      createdAt: new Date().toISOString()
    };

    // Ensure both employees exist
    [senderName, receiverName].forEach(empName => {
      const empExists = serverStore.employees.find(e => normalizeEntityId(e.name) === normalizeEntityId(empName));
      if (!empExists) {
        serverStore.employees.push({ name: empName, balance: 0 });
      }
    });

    serverStore.transactions.unshift(senderTx);
    serverStore.transactions.unshift(receiverTx);

    recalculateAuthoritativeBalances();
    saveStore(serverStore);

    auditService.log({
      action: 'CREATE',
      entityType: 'TRANSACTION',
      entityId: newId,
      actor: (req.body && req.body.actor) || 'المستخدم',
      description: `تحويل عهدة نقدية بمبلغ ${amountKwd.toFixed(3)} د.ك من (${senderName}) إلى (${receiverName})`,
      newValue: { senderTx, receiverTx }
    });

    return res.json({ success: true, id: newId, transaction: senderTx, data: senderTx });
  }

  const tx = {
    id: newId,
    rowId: newId,
    date: normalizeExcelDate(data.date) || new Date().toISOString().split('T')[0],
    employee: data.employee.trim(),
    branch: data.branch || 'الرئيسي',
    department: assignedDepartment,
    category: data.category || 'نثريات',
    description: data.description || '',
    amount: amountKwd,
    amountFils,
    type: data.type || 'Expense',
    targetMonth: data.targetMonth,
    createdAt: new Date().toISOString()
  };

  // Ensure employee exists in employees list
  const existingEmp = serverStore.employees.find(e => normalizeEntityId(e.name) === normalizeEntityId(tx.employee));
  if (!existingEmp) {
    serverStore.employees.push({ name: tx.employee, balance: 0 });
  }

  serverStore.transactions.unshift(tx);

  // Recalculate authoritative balances using exact integer arithmetic (Single Source of Truth)
  recalculateAuthoritativeBalances();
  saveStore(serverStore);

  // Audit Trail Recording
  auditService.log({
    action: 'CREATE',
    entityType: 'TRANSACTION',
    entityId: newId,
    actor: (req.body && req.body.actor) || 'المستخدم',
    description: `إضافة معاملة ${tx.type === 'Income' ? 'إيراد / توريد' : tx.type === 'Expense' ? 'مصروف' : 'تحويل'} بمبلغ ${amountKwd.toFixed(3)} د.ك للموظف (${tx.employee})`,
    newValue: tx
  });

  res.json({ success: true, id: newId, transaction: tx, data: tx });
});

app.put('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const updateData = req.body || {};

  // Find transaction by multi-stage resolution to guarantee in-place update and prevent duplicates:
  // 1. Direct ID or rowId match (both String and Number checks)
  let idx = serverStore.transactions.findIndex(t => 
    (t.id && (String(t.id).trim() === String(id).trim() || t.id === id)) || 
    (t.rowId && (String(t.rowId).trim() === String(id).trim() || t.rowId === id)) ||
    (updateData.id && (String(t.id).trim() === String(updateData.id).trim() || String(t.rowId).trim() === String(updateData.id).trim())) ||
    (updateData.rowId && (String(t.id).trim() === String(updateData.rowId).trim() || String(t.rowId).trim() === String(updateData.rowId).trim()))
  );

  // 2. updateData.originalRowIndex if provided and valid
  if (idx === -1 && updateData.originalRowIndex !== undefined) {
    const oIdx = parseInt(String(updateData.originalRowIndex), 10);
    if (!isNaN(oIdx) && oIdx >= 0 && oIdx < serverStore.transactions.length) {
      idx = oIdx;
    }
  }

  // 3. updateData.rowIndex match if provided
  if (idx === -1 && updateData.rowIndex !== undefined) {
    const rIdx = parseInt(String(updateData.rowIndex), 10);
    if (!isNaN(rIdx)) {
      if (rIdx >= 0 && rIdx < serverStore.transactions.length) {
        idx = rIdx;
      } else if (rIdx >= 2 && (rIdx - 2) < serverStore.transactions.length) {
        idx = rIdx - 2;
      }
    }
  }

  // 4. Index pattern in ID (e.g. row_0 or index_0)
  if (idx === -1) {
    const rowMatch = String(id).match(/^(?:row_|tx_|item_)?(\d+)$/i);
    if (rowMatch) {
      const parsedIdx = parseInt(rowMatch[1], 10);
      if (parsedIdx >= 0 && parsedIdx < serverStore.transactions.length) {
        idx = parsedIdx;
      }
    }
  }

  // 5. Content match using previous values if employee/date/amount were provided
  if (idx === -1) {
    const prevEmp = (updateData.previousEmployee || '').trim().toLowerCase();
    const prevDate = normalizeExcelDate(updateData.previousDate);
    const prevAmt = updateData.previousAmount !== undefined ? parseFloat(String(updateData.previousAmount)) : undefined;

    if (prevEmp && prevDate) {
      idx = serverStore.transactions.findIndex(t => {
        const empMatch = normalizeEntityId(t.employee) === normalizeEntityId(prevEmp);
        const dateMatch = normalizeExcelDate(t.date) === prevDate;
        const amtMatch = prevAmt !== undefined ? Math.abs(toFils(t.amount) - toFils(prevAmt)) === 0 : true;
        return empMatch && dateMatch && amtMatch;
      });
    }
  }

  // 6. Content match using previous employee + previous amount
  if (idx === -1 && updateData.previousEmployee && updateData.previousAmount !== undefined) {
    const prevEmp = (updateData.previousEmployee || '').trim().toLowerCase();
    const prevAmt = parseFloat(String(updateData.previousAmount));
    idx = serverStore.transactions.findIndex(t => 
      normalizeEntityId(t.employee) === normalizeEntityId(prevEmp) &&
      Math.abs(toFils(t.amount) - toFils(prevAmt)) === 0
    );
  }

  // 7. Content match using current values (employee + date + amount)
  if (idx === -1 && updateData.employee && updateData.date && updateData.amount !== undefined) {
    const curEmp = (updateData.employee || '').trim().toLowerCase();
    const curDate = normalizeExcelDate(updateData.date);
    const curAmt = parseFloat(String(updateData.amount));
    idx = serverStore.transactions.findIndex(t => 
      normalizeEntityId(t.employee) === normalizeEntityId(curEmp) && 
      normalizeExcelDate(t.date) === curDate &&
      Math.abs(toFils(t.amount) - toFils(curAmt)) === 0
    );
  }

  // 8. Content match using current employee + date
  if (idx === -1 && updateData.employee && updateData.date) {
    const curEmp = (updateData.employee || '').trim().toLowerCase();
    const curDate = normalizeExcelDate(updateData.date);
    idx = serverStore.transactions.findIndex(t => 
      normalizeEntityId(t.employee) === normalizeEntityId(curEmp) && 
      normalizeExcelDate(t.date) === curDate
    );
  }

  // 9. If only 1 transaction exists in store and an update was requested
  if (idx === -1 && serverStore.transactions.length === 1) {
    idx = 0;
  }

  // CRITICAL: NEVER blindly duplicate with unshift! An update MUST modify an existing record.
  if (idx === -1) {
    console.warn(`[PUT /api/transactions] Transaction #${id} not found in store`);
    return sendError(res, `لم يتم العثور على المعاملة المطلوب تعديلها برقم (#${id}) في سجل الحركات المحاسبية لمنع تكرار القيود أو تضارب الأرصدة`, 404);
  }

  const previousValue = { ...serverStore.transactions[idx] };

  let amountKwd = updateData.amount !== undefined ? parseFloat(String(updateData.amount)) || 0 : (previousValue ? previousValue.amount : 0);
  let amountFils = toFils(amountKwd);
  amountKwd = toKWD(amountFils);

  const effectiveBranch = (updateData.branch !== undefined ? updateData.branch : (previousValue ? previousValue.branch : 'الرئيسي')) || 'الرئيسي';
  const isCityBranch = effectiveBranch.trim() === 'سيتي';
  let effectiveDepartment = updateData.department !== undefined ? updateData.department : (previousValue ? previousValue.department : null);
  if (!isCityBranch) {
    effectiveDepartment = null;
  }

  const effectiveId = (previousValue && previousValue.id) || id || updateData.id || Date.now().toString();
  const effectiveEmployee = (updateData.employee || (previousValue ? previousValue.employee : 'عام') || 'عام').trim();
  const effectiveDate = normalizeExcelDate(updateData.date) || (previousValue ? previousValue.date : new Date().toISOString().split('T')[0]);
  const effectiveType = updateData.type || (previousValue ? previousValue.type : (updateData.income > 0 ? 'Income' : 'Expense'));

  const isIncoming = effectiveType === 'Income' || effectiveType === 'Transfer-In' || effectiveType === 'إيراد';
  const effectiveIncome = isIncoming ? amountKwd : 0;
  const effectiveExpense = !isIncoming ? amountKwd : 0;

  const updatedRecord = {
    ...previousValue,
    ...updateData,
    id: effectiveId,
    rowId: effectiveId,
    employee: effectiveEmployee,
    date: effectiveDate,
    branch: effectiveBranch,
    department: effectiveDepartment,
    type: effectiveType,
    category: updateData.category || (previousValue ? previousValue.category : 'عام'),
    description: updateData.description !== undefined ? updateData.description : (previousValue ? previousValue.description : ''),
    targetMonth: updateData.targetMonth !== undefined ? updateData.targetMonth : (previousValue ? previousValue.targetMonth : ''),
    amount: amountKwd,
    amountFils,
    income: effectiveIncome,
    expense: effectiveExpense,
    isAccrual: Boolean(updateData.isAccrual),
    isAccrued: Boolean(updateData.isAccrual),
    vendorName: updateData.vendorName !== undefined ? String(updateData.vendorName).trim() : (previousValue?.vendorName || ''),
    sender: updateData.sender !== undefined ? updateData.sender : (previousValue?.sender || ''),
    receiver: updateData.receiver !== undefined ? updateData.receiver : (previousValue?.receiver || ''),
    updatedAt: new Date().toISOString()
  };

  // 100% In-Place Update (Zero Duplicates, Zero Deletion)
  serverStore.transactions[idx] = updatedRecord;

  // If this was part of a paired Transfer, update the other leg as well
  if ((updatedRecord.type === 'Transfer' || updatedRecord.type === 'Transfer-Out' || updatedRecord.type === 'Transfer-In') && (updateData.sender || previousValue?.sender) && (updateData.receiver || previousValue?.receiver)) {
    const senderName = (updateData.sender || previousValue?.sender || '').trim();
    const receiverName = (updateData.receiver || previousValue?.receiver || '').trim();
    const pairIdx = serverStore.transactions.findIndex((t, i) => 
      i !== idx && 
      (t.type === 'Transfer-In' || t.type === 'Transfer-Out' || t.type === 'Transfer') &&
      ((t.sender === senderName && t.receiver === receiverName) || (t.employee === receiverName && senderName)) &&
      normalizeExcelDate(t.date) === normalizeExcelDate(previousValue ? previousValue.date : effectiveDate)
    );
    if (pairIdx !== -1) {
      const isSender = updatedRecord.employee === senderName;
      serverStore.transactions[pairIdx] = {
        ...serverStore.transactions[pairIdx],
        date: effectiveDate,
        branch: effectiveBranch,
        amount: amountKwd,
        amountFils,
        sender: senderName,
        receiver: receiverName,
        targetMonth: updatedRecord.targetMonth,
        description: isSender ? `استلام عهدة نقدية محولة من ${senderName}` : `تحويل عهدة نقدية من ${senderName} إلى ${receiverName}`,
        updatedAt: new Date().toISOString()
      };
    }
  }

  // Ensure employee exists in employees directory
  const existingEmp = serverStore.employees.find(e => normalizeEntityId(e.name) === normalizeEntityId(effectiveEmployee));
  if (!existingEmp) {
    serverStore.employees.push({ name: effectiveEmployee, balance: 0 });
  }

  recalculateAuthoritativeBalances();
  saveStore(serverStore);

  auditService.log({
    action: 'UPDATE',
    entityType: 'TRANSACTION',
    entityId: effectiveId,
    actor: updateData.actor || 'المستخدم',
    description: `تعديل المعاملة رقم #${effectiveId} للموظف (${effectiveEmployee}) بمبلغ ${amountKwd.toFixed(3)} د.ك`,
    previousValue: previousValue || {},
    newValue: updatedRecord
  });

  const updatedBalances = serverStore.employees.map(e => ({
    name: e.name,
    balance: e.balance,
    balanceFils: toFils(e.balance),
    formatted: `${Number(e.balance).toFixed(3)} د.ك`
  }));

  res.json({ 
    success: true, 
    id: effectiveId,
    transaction: updatedRecord, 
    data: updatedRecord, 
    balances: updatedBalances,
    message: 'تم حفظ وتحديث بيانات المعاملة والرصيد بنجاح' 
  });
});

app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  let idx = serverStore.transactions.findIndex(t => t.id === id || String(t.rowId) === String(id));

  if (idx === -1) {
    const rowMatch = String(id).match(/(?:row_|_)?(\d+)$/);
    if (rowMatch) {
      const parsedIdx = parseInt(rowMatch[1], 10);
      if (parsedIdx >= 0 && parsedIdx < serverStore.transactions.length) {
        idx = parsedIdx;
      }
    }
  }

  if (idx === -1) {
    // Acknowledge deletion gracefully even if already pruned
    res.json({ success: true, message: 'تم إزالة المعاملة بنجاح', data: { id } });
    return;
  }

  const target = serverStore.transactions[idx];
  serverStore.transactions.splice(idx, 1);

  // If target was part of a paired transfer, remove the paired transfer as well
  if ((target.type === 'Transfer-In' || target.type === 'Transfer-Out' || target.type === 'Transfer') && target.sender && target.receiver) {
    const pairIdx = serverStore.transactions.findIndex(t => 
      (t.type === 'Transfer-In' || t.type === 'Transfer-Out' || t.type === 'Transfer') &&
      t.sender === target.sender &&
      t.receiver === target.receiver &&
      normalizeExcelDate(t.date) === normalizeExcelDate(target.date) &&
      toFils(t.amount) === toFils(target.amount)
    );
    if (pairIdx !== -1) {
      serverStore.transactions.splice(pairIdx, 1);
    }
  }

  recalculateAuthoritativeBalances();
  saveStore(serverStore);

  auditService.log({
    action: 'DELETE',
    entityType: 'TRANSACTION',
    entityId: id,
    actor: (req.body && req.body.actor) || 'المستخدم',
    description: `حذف المعاملة #${id} بمبلغ ${target.amount} د.ك للموظف (${target.employee})`,
    previousValue: target
  });

  const updatedBalances = serverStore.employees.map(e => ({
    name: e.name,
    balance: e.balance,
    balanceFils: toFils(e.balance),
    formatted: `${Number(e.balance).toFixed(3)} د.ك`
  }));

  res.json({ 
    success: true, 
    message: 'تم حذف المعاملة وتحديث الرصيد بنجاح', 
    data: { id },
    balances: updatedBalances
  });
});

// 4. Balances Endpoint (Single Source of Truth, computed via exact integer fils)
app.get('/api/balances', (_req, res) => {
  recalculateAuthoritativeBalances();
  saveStore(serverStore);

  const formattedBalances = serverStore.employees.map(e => ({
    name: e.name,
    balance: e.balance,
    balanceFils: toFils(e.balance),
    formatted: `${e.balance.toFixed(3)} د.ك`
  }));

  res.json({
    success: true,
    balances: formattedBalances,
    data: formattedBalances
  });
});

// 4.1. Financial Reconciliation Endpoint (Periodical & On-Demand Audit)
app.get('/api/reconciliation', (_req, res) => {
  const report = performReconciliation(
    serverStore.transactions,
    serverStore.employees,
    serverStore.branches
  );
  res.json({
    success: true,
    report,
    data: report
  });
});

app.post('/api/reconciliation', (req, res) => {
  // Re-synchronize and force-balance all employee ledgers strictly to calculated transaction sums
  const beforeReport = performReconciliation(
    serverStore.transactions,
    serverStore.employees,
    serverStore.branches
  );

  recalculateAuthoritativeBalances();
  saveStore(serverStore);

  const afterReport = performReconciliation(
    serverStore.transactions,
    serverStore.employees,
    serverStore.branches
  );

  auditService.log({
    action: 'RECONCILE',
    entityType: 'BALANCE',
    entityId: 'SYSTEM_ALL',
    actor: (req.body && req.body.actor) || 'المراقب المالي',
    description: `إجراء مطابقة وتسوية مالية شاملة لـ ${serverStore.employees.length} موظف`,
    previousValue: beforeReport,
    newValue: afterReport
  });

  res.json({
    success: true,
    message: 'تمت التسوية والمطابقة بنجاح وإعادة التوازن للنظام',
    report: afterReport,
    data: afterReport
  });
});

// 4.2. Audit Trail Endpoint
app.get('/api/audit-logs', (req, res) => {
  const { entityType, entityId, limit } = req.query;
  const logs = auditService.getAll({
    entityType: entityType ? String(entityType) : undefined,
    entityId: entityId ? String(entityId) : undefined,
    limit: limit ? parseInt(String(limit), 10) : 100
  });

  res.json({
    success: true,
    total: logs.length,
    logs,
    data: logs
  });
});

// 5. Employees CRUD
app.get('/api/employees', (_req, res) => {
  res.json({ success: true, employees: serverStore.employees, data: serverStore.employees });
});

app.post('/api/employees', (req, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, parsed.error.issues[0]?.message || 'اسم الموظف غير صالح', 400);
  }

  const cleanName = parsed.data.name;
  const exists = serverStore.employees.find(e => normalizeEntityId(e.name) === normalizeEntityId(cleanName));
  if (!exists) {
    const newEmp = { name: cleanName, balance: 0 };
    serverStore.employees.push(newEmp);
    recalculateAuthoritativeBalances();
    saveStore(serverStore);

    auditService.log({
      action: 'CREATE',
      entityType: 'BALANCE',
      entityId: `emp_${normalizeEntityId(cleanName)}`,
      actor: (req.body && req.body.actor) || 'المستخدم',
      description: `إضافة موظف/أمين عهدة جديد: ${cleanName}`,
      newValue: newEmp
    });
  }

  res.json({ success: true, employees: serverStore.employees, data: serverStore.employees });
});

app.delete('/api/employees/:name', (req, res) => {
  const rawName = decodeURIComponent(req.params.name);
  const target = serverStore.employees.find(e => normalizeEntityId(e.name) === normalizeEntityId(rawName));

  if (!target) {
    return sendError(res, 'الموظف غير موجود', 404);
  }

  serverStore.employees = serverStore.employees.filter(e => normalizeEntityId(e.name) !== normalizeEntityId(rawName));
  saveStore(serverStore);

  auditService.log({
    action: 'DELETE',
    entityType: 'BALANCE',
    entityId: `emp_${normalizeEntityId(rawName)}`,
    actor: (req.body && req.body.actor) || 'المستخدم',
    description: `حذف الموظف: ${rawName}`,
    previousValue: target
  });

  res.json({ success: true, employees: serverStore.employees, data: serverStore.employees });
});

// 6. Orders CRUD
app.get('/api/orders', (_req, res) => {
  res.json({ success: true, orders: serverStore.orders || [], data: serverStore.orders || [] });
});

app.post('/api/orders', (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, parsed.error.issues[0]?.message || 'بيانات الطلبية غير صحيحة', 400, parsed.error.issues);
  }

  const order = parsed.data;
  const newOrder = {
    ...order,
    id: req.body.id || `ord-${Date.now()}`,
    orderNumber: req.body.orderNumber || `ORD-${new Date().getFullYear()}-${String((serverStore.orders || []).length + 1).padStart(3, '0')}`,
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  serverStore.orders.unshift(newOrder);
  saveStore(serverStore);

  auditService.log({
    action: 'CREATE',
    entityType: 'ORDER',
    entityId: newOrder.id,
    actor: (req.body && req.body.actor) || 'المستخدم',
    description: `إنشاء طلبية جديدة: ${newOrder.orderNumber} - ${newOrder.title} بقيمة ${newOrder.amount} د.ك`,
    newValue: newOrder
  });

  res.json({ success: true, order: newOrder, data: newOrder });
});

app.put('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const idx = serverStore.orders.findIndex(o => o.id === id);

  if (idx === -1) {
    return sendError(res, 'الطلبية غير موجودة', 404);
  }

  const previousValue = { ...serverStore.orders[idx] };
  serverStore.orders[idx] = {
    ...serverStore.orders[idx],
    ...updateData,
    updatedAt: new Date().toISOString()
  };

  saveStore(serverStore);

  auditService.log({
    action: 'UPDATE',
    entityType: 'ORDER',
    entityId: id,
    actor: updateData.actor || 'المستخدم',
    description: `تعديل الطلبية: ${serverStore.orders[idx].orderNumber}`,
    previousValue,
    newValue: serverStore.orders[idx]
  });

  res.json({ success: true, order: serverStore.orders[idx], data: serverStore.orders[idx] });
});

app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const target = serverStore.orders.find(o => o.id === id);

  if (!target) {
    return sendError(res, 'الطلبية غير موجودة', 404);
  }

  serverStore.orders = serverStore.orders.filter(o => o.id !== id);
  saveStore(serverStore);

  auditService.log({
    action: 'DELETE',
    entityType: 'ORDER',
    entityId: id,
    actor: (req.body && req.body.actor) || 'المستخدم',
    description: `حذف الطلبية: ${target.orderNumber} - ${target.title}`,
    previousValue: target
  });

  res.json({ success: true, message: 'تم حذف الطلبية بنجاح' });
});

// 6.1 Automated Test Suite Diagnostic Endpoint
app.get('/api/health/test-suite', (_req, res) => {
  const report = performReconciliation(
    serverStore.transactions,
    serverStore.employees,
    serverStore.branches
  );

  const tests = [
    { name: 'Floating Point IEEE-754 Precision (Fils)', passed: toFils(0.1) + toFils(0.2) === toFils(0.3) },
    { name: 'Single Source of Truth Balances', passed: Array.isArray(serverStore.employees) },
    { name: 'Double Entry / Reconciliation Engine', passed: typeof report.isSystemBalanced === 'boolean' },
    { name: 'Validation Engine (Zod)', passed: typeof transactionSchema.safeParse === 'function' },
    { name: 'Audit Trail Persistence', passed: typeof auditService.log === 'function' }
  ];

  const allPassed = tests.every(t => t.passed);
  res.json({
    success: allPassed,
    status: allPassed ? 'all_passed' : 'some_failed',
    totalTests: tests.length,
    passedTests: tests.filter(t => t.passed).length,
    tests,
    reconciliation: {
      isSystemBalanced: report.isSystemBalanced,
      totalDiscrepancyKWD: report.totalDiscrepancyKWD
    }
  });
});

// 7. Budgets CRUD
app.get('/api/budgets', (_req, res) => {
  res.json({ success: true, budgets: serverStore.budgets || [] });
});

app.post('/api/budgets', (req, res) => {
  const { budgets } = req.body;
  if (Array.isArray(budgets)) {
    serverStore.budgets = budgets;
    saveStore(serverStore);
  }
  res.json({ success: true, budgets: serverStore.budgets });
});

// 8. Settlements CRUD
app.get('/api/settlements', (_req, res) => {
  res.json({ success: true, settlements: serverStore.settlements || [] });
});

app.post('/api/settlements', (req, res) => {
  const settlement = req.body;
  const newSettlement = {
    ...settlement,
    id: settlement.id || `stl-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  serverStore.settlements.unshift(newSettlement);
  saveStore(serverStore);
  res.json({ success: true, settlement: newSettlement });
});

// 9. Sync Endpoint: Synchronize data between Google Sheets, Client and Backend
app.post('/api/sync', (req, res) => {
  const { transactions, employees, orders, settings } = req.body;

  if (Array.isArray(transactions) && transactions.length > 0) {
    // Merge without duplicates
    const existingIds = new Set(serverStore.transactions.map(t => String(t.id || t.rowId)));
    transactions.forEach(t => {
      const id = String(t.id || t.rowId || t.rowIndex);
      if (id && !existingIds.has(id)) {
        const cleanDate = normalizeExcelDate(t.date || t.raw_date || t['التاريخ']);
        serverStore.transactions.push({
          ...t,
          date: cleanDate || t.date || new Date().toISOString().split('T')[0]
        });
        existingIds.add(id);
      }
    });
  }

  if (Array.isArray(employees) && employees.length > 0) {
    employees.forEach(emp => {
      const exists = serverStore.employees.find(e => e.name === emp.name);
      if (!exists) {
        serverStore.employees.push(emp);
      } else {
        exists.balance = emp.balance;
      }
    });
  }

  if (Array.isArray(orders) && orders.length > 0) {
    const existingOrderIds = new Set(serverStore.orders.map(o => o.id));
    orders.forEach(o => {
      if (!existingOrderIds.has(o.id)) {
        serverStore.orders.push(o);
        existingOrderIds.add(o.id);
      }
    });
  }

  if (settings) {
    if (Array.isArray(settings.branches)) serverStore.branches = settings.branches;
    if (Array.isArray(settings.categories)) serverStore.categories = settings.categories;
  }

  saveStore(serverStore);

  res.json({
    success: true,
    message: 'تمت المزامنة الكاملة بنجاح',
    syncedAt: new Date().toISOString(),
    counts: {
      transactions: serverStore.transactions.length,
      employees: serverStore.employees.length,
      orders: serverStore.orders.length
    }
  });
});

// 9.1. Direct In-Order Excel Uploader to Supabase
app.post('/api/supabase/upload-excel', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return sendError(res, 'لم يتم إرسال أي صفوف للرفع', 400);
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return sendError(res, 'إعدادات الاتصال بـ Supabase غير مهيأة على الخادم', 500);
    }

    // Prepare rows in exact order with row_index matching Excel
    const mappedRows = rows.map((r: any, idx: number) => {
      const rowIndex = Number(r.rowIndex || r.row_index || (idx + 2));
      const amountVal = parseFloat(String(r.amount || r.raw_amount || 0).replace(/[^0-9.-]/g, '')) || 0;

      return {
        row_index: rowIndex,
        raw_id: r.id ? String(r.id).trim() : (r.raw_id ? String(r.raw_id).trim() : null),
        raw_date: normalizeExcelDate(r.date || r.raw_date || r['التاريخ'] || r['تاريخ']) || (r.date ? String(r.date).trim() : null),
        raw_employee: r.employee ? String(r.employee).trim() : (r.raw_employee ? String(r.raw_employee).trim() : null),
        raw_branch: r.branch ? String(r.branch).trim() : (r.raw_branch ? String(r.raw_branch).trim() : null),
        raw_department: r.department ? String(r.department).trim() : (r.raw_department ? String(r.raw_department).trim() : null),
        raw_type: r.type ? String(r.type).trim() : (r.raw_type ? String(r.raw_type).trim() : null),
        raw_category: r.category ? String(r.category).trim() : (r.raw_category ? String(r.raw_category).trim() : null),
        raw_amount: Math.round(amountVal * 1000) / 1000,
        raw_description: r.description ? String(r.description).trim() : (r.raw_description ? String(r.raw_description).trim() : null),
        raw_related_id: r.relatedId ? String(r.relatedId).trim() : (r.raw_related_id ? String(r.raw_related_id).trim() : null),
        raw_timestamp: r.timestamp ? String(r.timestamp).trim() : (r.raw_timestamp ? String(r.raw_timestamp).trim() : null),
        raw_computer_number: r.computerNumber ? String(r.computerNumber).trim() : (r.raw_computer_number ? String(r.raw_computer_number).trim() : null)
      };
    });

    // Sort strictly by row_index ascending to ensure in-order execution
    mappedRows.sort((a, b) => a.row_index - b.row_index);

    // Upsert to excel_raw_ledger in chunks of 200
    const CHUNK_SIZE = 200;
    let totalInserted = 0;

    for (let i = 0; i < mappedRows.length; i += CHUNK_SIZE) {
      const chunk = mappedRows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('excel_raw_ledger')
        .upsert(chunk, { onConflict: 'row_index' });

      if (error) {
        console.error('Supabase Excel upload error:', error);
        return sendError(res, `خطأ في إدراج الدفعة (${i + 1} - ${i + chunk.length}): ${error.message}`, 500);
      }
      totalInserted += chunk.length;
    }

    auditService.log({
      action: 'IMPORT',
      entityType: 'SUPABASE_EXCEL',
      entityId: `EXCEL_${Date.now()}`,
      actor: (req.body && req.body.actor) || 'المستخدم',
      description: `رفع وتخزين ${totalInserted} صف إكسيل في جدول excel_raw_ledger بالترتيب الدقيق للأصل`,
      newValue: { count: totalInserted, minRow: mappedRows[0]?.row_index, maxRow: mappedRows[mappedRows.length - 1]?.row_index }
    });

    res.json({
      success: true,
      message: `تم رفع ${totalInserted} صف بنجاح إلى جدول excel_raw_ledger في Supabase بنفس ترتيب الإكسيل تماماً`,
      totalInserted
    });
  } catch (err: any) {
    console.error('Failed to upload excel to supabase:', err);
    sendError(res, err.message || 'حدث خطأ أثناء رفع بيانات الإكسيل', 500);
  }
});

// 10. Gemini AI Financial Auditor (Server-Side)
app.post('/api/ai/audit', async (req, res) => {
  try {
    const ai = getAI();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'مفتاح GEMINI_API_KEY غير مهيأ في الخادم'
      });
    }

    const { branch, month, balances, transactions, prompt } = req.body;

    const systemInstruction = `أنت مدقق ومستشار مالي محاسبي معتمد بالدينار الكويتي (KWD). 
قم بتحليل البيانات المالية المقدمة بدقة وتقديم تقرير تحليلي باللغة العربية يشمل:
1. نظرة عامة على السيولة والمركز المالي.
2. كشف أي شذوذ أو انحرافات أو هدر في المصروفات.
3. التوصيات التنفيذية لخفض التكاليف وترشيد العهد النقدية.
قدم النتيجة بتنسيق Markdown مالي أنيق ومنظم.`;

    const userPrompt = prompt || `يرجى تحليل كشف الحساب والعهد المالية التالي:
الفرع: ${branch || 'كافة الفروع'}
الشهر: ${month || 'الحالي'}
أرصدة الموظفين الحالية: ${JSON.stringify(balances || serverStore.employees)}
عدد المعاملات المسجلة: ${transactions ? transactions.length : serverStore.transactions.length}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.3
      }
    });

    res.json({
      success: true,
      analysis: response.text
    });
  } catch (err: any) {
    console.error('AI Audit Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'فشل توليد التحليل المالي الذكي'
    });
  }
});

// ----------------------------------------------------
// VITE MIDDLEWARE & STATIC ASSETS
// ----------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Financial Server & Backend APIs running on http://0.0.0.0:${PORT}`);
  });
}

start();
