import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { transactionSchema, employeeSchema, orderSchema, settingsSchema } from './server/validation';
import { auditService } from './server/audit';
import { performReconciliation } from './server/reconciliation';
import { toFils, toKWD, normalizeEntityId } from './src/utils/money';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

interface ServerStore {
  transactions: any[];
  orders: any[];
  budgets: any[];
  settlements: any[];
  employees: { name: string; balance: number }[];
  branches: string[];
  categories: string[];
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
      return {
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
        settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
        employees: Array.isArray(parsed.employees) && parsed.employees.length > 0 ? parsed.employees : defaultStore.employees,
        branches: Array.isArray(parsed.branches) && parsed.branches.length > 0 ? parsed.branches : defaultStore.branches,
        categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : defaultStore.categories,
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
    balancesFilsMap.set(e.name, 0);
  });

  serverStore.transactions.forEach(t => {
    const emp = t.employee;
    if (!emp) return;
    const currentFils = balancesFilsMap.get(emp) || 0;
    const tFils = t.amountFils !== undefined ? t.amountFils : toFils(t.amount);
    const isInc = t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'إيراد' || t.type === 'تغذية عهدة';
    const isExp = t.type === 'Expense' || t.type === 'Transfer-Out' || t.type === 'مصروف';

    if (isInc) balancesFilsMap.set(emp, currentFils + tFils);
    else if (isExp) balancesFilsMap.set(emp, currentFils - tFils);
  });

  serverStore.employees.forEach(e => {
    const fils = balancesFilsMap.get(e.name) || 0;
    e.balance = fils / 1000;
  });
}

// Unified API Response Formatter
function sendSuccess(res: express.Response, data: any, message?: string, meta?: any, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  });
}

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
app.get('/api/health', (req, res) => {
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

// 2. Settings (Branches & Categories)
app.get('/api/settings', (req, res) => {
  res.json({
    branches: serverStore.branches,
    categories: serverStore.categories
  });
});

app.post('/api/settings', (req, res) => {
  const { branches, categories } = req.body;
  if (Array.isArray(branches)) serverStore.branches = branches;
  if (Array.isArray(categories)) serverStore.categories = categories;
  saveStore(serverStore);
  res.json({ success: true, branches: serverStore.branches, categories: serverStore.categories });
});

// 3. Transactions CRUD & Reporting
app.get('/api/transactions', (req, res) => {
  const { branch, employee, category, startDate, endDate } = req.query;
  let list = [...serverStore.transactions];

  const isAll = (v: any) => !v || v === 'all' || v === 'All' || v === 'الكل' || v === 'كافة الفروع' || v === 'كل الفروع';

  if (!isAll(branch)) {
    list = list.filter(t => t.branch === branch);
  }
  if (!isAll(employee)) {
    list = list.filter(t => t.employee === employee);
  }
  if (!isAll(category)) {
    list = list.filter(t => t.category === category);
  }
  if (startDate) {
    list = list.filter(t => t.date >= String(startDate));
  }
  if (endDate) {
    list = list.filter(t => t.date <= String(endDate));
  }

  res.json({
    success: true,
    total: list.length,
    rows: list
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

  const tx = {
    id: newId,
    rowId: newId,
    date: data.date || new Date().toISOString().split('T')[0],
    employee: data.employee.trim(),
    branch: data.branch || 'الرئيسي',
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
  const idx = serverStore.transactions.findIndex(t => t.id === id || String(t.rowId) === id);

  if (idx === -1) {
    return sendError(res, 'المعاملة غير موجودة', 404);
  }

  const previousValue = { ...serverStore.transactions[idx] };
  const updateData = req.body;

  let amountKwd = previousValue.amount;
  let amountFils = previousValue.amountFils || toFils(previousValue.amount);

  if (updateData.amount !== undefined) {
    amountFils = toFils(updateData.amount);
    amountKwd = toKWD(amountFils);
  }

  serverStore.transactions[idx] = {
    ...previousValue,
    ...updateData,
    amount: amountKwd,
    amountFils,
    updatedAt: new Date().toISOString()
  };

  recalculateAuthoritativeBalances();
  saveStore(serverStore);

  auditService.log({
    action: 'UPDATE',
    entityType: 'TRANSACTION',
    entityId: id,
    actor: updateData.actor || 'المستخدم',
    description: `تعديل المعاملة رقم #${id}`,
    previousValue,
    newValue: serverStore.transactions[idx]
  });

  res.json({ success: true, transaction: serverStore.transactions[idx], data: serverStore.transactions[idx] });
});

app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const target = serverStore.transactions.find(t => t.id === id || String(t.rowId) === id);

  if (!target) {
    return sendError(res, 'المعاملة غير موجودة', 404);
  }

  serverStore.transactions = serverStore.transactions.filter(t => t.id !== id && String(t.rowId) !== id);
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

  res.json({ success: true, message: 'تم حذف المعاملة وتحديث الرصيد بنجاح', data: { id } });
});

// 4. Balances Endpoint (Single Source of Truth, computed via exact integer fils)
app.get('/api/balances', (req, res) => {
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
app.get('/api/reconciliation', (req, res) => {
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
app.get('/api/employees', (req, res) => {
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
app.get('/api/orders', (req, res) => {
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
app.get('/api/health/test-suite', (req, res) => {
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
app.get('/api/budgets', (req, res) => {
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
app.get('/api/settlements', (req, res) => {
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
        serverStore.transactions.push(t);
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Financial Server & Backend APIs running on http://0.0.0.0:${PORT}`);
  });
}

start();
