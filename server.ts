import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

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
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = fs.readFileSync(STORE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not read store file, using initial defaults:', err);
  }
  return {
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

  if (branch && branch !== 'all') {
    list = list.filter(t => t.branch === branch);
  }
  if (employee && employee !== 'all') {
    list = list.filter(t => t.employee === employee);
  }
  if (category && category !== 'all') {
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
  const data = req.body;
  if (!data || !data.amount || !data.employee) {
    return res.status(400).json({ success: false, error: 'البيانات غير مكتملة' });
  }

  const newId = Date.now().toString();
  const tx = {
    id: newId,
    rowId: newId,
    date: data.date || new Date().toISOString().split('T')[0],
    employee: data.employee,
    branch: data.branch || '',
    category: data.category || 'نثريات',
    description: data.description || '',
    amount: parseFloat(data.amount) || 0,
    type: data.type || 'Expense',
    targetMonth: data.targetMonth,
    createdAt: new Date().toISOString()
  };

  serverStore.transactions.unshift(tx);

  // Update employee balance in memory
  const emp = serverStore.employees.find(e => e.name === tx.employee);
  if (emp) {
    if (tx.type === 'Income' || tx.type === 'Transfer-In') {
      emp.balance += tx.amount;
    } else if (tx.type === 'Expense' || tx.type === 'Transfer-Out') {
      emp.balance -= tx.amount;
    }
  } else {
    serverStore.employees.push({
      name: tx.employee,
      balance: tx.type === 'Income' ? tx.amount : -tx.amount
    });
  }

  saveStore(serverStore);
  res.json({ success: true, id: newId, transaction: tx });
});

app.put('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const idx = serverStore.transactions.findIndex(t => t.id === id || String(t.rowId) === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'المعاملة غير موجودة' });
  }

  serverStore.transactions[idx] = {
    ...serverStore.transactions[idx],
    ...updateData,
    updatedAt: new Date().toISOString()
  };

  saveStore(serverStore);
  res.json({ success: true, transaction: serverStore.transactions[idx] });
});

app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const initialLen = serverStore.transactions.length;
  serverStore.transactions = serverStore.transactions.filter(t => t.id !== id && String(t.rowId) !== id);

  if (serverStore.transactions.length === initialLen) {
    return res.status(404).json({ success: false, error: 'المعاملة غير موجودة' });
  }

  saveStore(serverStore);
  res.json({ success: true, message: 'تم حذف المعاملة بنجاح' });
});

// 4. Balances Endpoint
app.get('/api/balances', (req, res) => {
  // Aggregate directly from transaction records
  const balancesMap = new Map<string, number>();

  // Initialize with known employees
  serverStore.employees.forEach(e => {
    balancesMap.set(e.name, 0);
  });

  serverStore.transactions.forEach(t => {
    const emp = t.employee;
    if (!emp) return;
    const current = balancesMap.get(emp) || 0;
    const inc = (t.type === 'Income' || t.type === 'Transfer-In') ? (parseFloat(t.amount) || 0) : 0;
    const exp = (t.type === 'Expense' || t.type === 'Transfer-Out') ? (parseFloat(t.amount) || 0) : 0;
    balancesMap.set(emp, current + inc - exp);
  });

  const list = Array.from(balancesMap.entries()).map(([name, balance]) => ({
    name,
    balance
  }));

  res.json({
    success: true,
    balances: list
  });
});

// 5. Employees CRUD
app.get('/api/employees', (req, res) => {
  res.json({ success: true, employees: serverStore.employees });
});

app.post('/api/employees', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'اسم الموظف مطلوب' });
  }

  const cleanName = name.trim();
  const exists = serverStore.employees.find(e => e.name === cleanName);
  if (!exists) {
    serverStore.employees.push({ name: cleanName, balance: 0 });
    saveStore(serverStore);
  }

  res.json({ success: true, employees: serverStore.employees });
});

app.delete('/api/employees/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  serverStore.employees = serverStore.employees.filter(e => e.name !== name);
  saveStore(serverStore);
  res.json({ success: true, employees: serverStore.employees });
});

// 6. Orders CRUD
app.get('/api/orders', (req, res) => {
  res.json({ success: true, orders: serverStore.orders || [] });
});

app.post('/api/orders', (req, res) => {
  const order = req.body;
  if (!order || !order.title) {
    return res.status(400).json({ success: false, error: 'بيانات الطلبية غير مكتملة' });
  }

  const newOrder = {
    ...order,
    id: order.id || `ord-${Date.now()}`,
    orderNumber: order.orderNumber || `ORD-${new Date().getFullYear()}-${String(serverStore.orders.length + 1).padStart(3, '0')}`,
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  serverStore.orders.unshift(newOrder);
  saveStore(serverStore);
  res.json({ success: true, order: newOrder });
});

app.put('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const idx = serverStore.orders.findIndex(o => o.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'الطلبية غير موجودة' });
  }

  serverStore.orders[idx] = {
    ...serverStore.orders[idx],
    ...updateData,
    updatedAt: new Date().toISOString()
  };

  saveStore(serverStore);
  res.json({ success: true, order: serverStore.orders[idx] });
});

app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  serverStore.orders = serverStore.orders.filter(o => o.id !== id);
  saveStore(serverStore);
  res.json({ success: true, message: 'تم حذف الطلبية بنجاح' });
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
