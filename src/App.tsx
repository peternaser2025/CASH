import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Users, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowLeftRight,
  Filter,
  Download,
  Search,
  Calendar,
  ChevronRight,
  TrendingUp,
  Wallet,
  Building2,
  LogOut
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp,
  where,
  getDocs,
  doc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { db, auth } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Transaction {
  id: string;
  date: string;
  employee: string;
  branch: string;
  type: 'Income' | 'Expense' | 'Transfer-In' | 'Transfer-Out' | 'Accrual-In' | 'Accrual-Out';
  category: string;
  amount: number;
  description: string;
  relatedId?: string;
  timestamp: any;
}

interface Employee {
  id: string;
  name: string;
  balance: number;
  status: string;
}

const CATEGORIES = [
  "General", "Salaries", "Rent", "Utilities", "Supplies", "Marketing", "Maintenance", "Transport", "Other"
];

const BRANCHES = ["Main Branch", "Salmiya", "Hawally", "Farwaniya", "Ahmadi"];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'reports' | 'employees'>('dashboard');

  // Filters for Reporting
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    employee: 'all',
    branch: 'all',
    category: 'all',
    type: 'all'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribeTrans = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
    });

    const unsubscribeEmp = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(data);
    });

    return () => {
      unsubscribeTrans();
      unsubscribeEmp();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-2xl shadow-indigo-500/20">
              <Wallet size={48} />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">KWD Finance Pro</h1>
            <p className="mt-4 text-slate-400">Enterprise Grade Petty Cash Management System</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full py-4 px-6 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Wallet size={20} />
          </div>
          <span className="font-bold text-lg tracking-tight">KWD Finance</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={<ArrowLeftRight size={20} />} 
            label="Transactions" 
            active={activeTab === 'transactions'} 
            onClick={() => setActiveTab('transactions')} 
          />
          <SidebarItem 
            icon={<FileText size={20} />} 
            label="Reports" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
          />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Employees" 
            active={activeTab === 'employees'} 
            onClick={() => setActiveTab('employees')} 
          />
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full" alt="User" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-xl font-semibold text-slate-800 capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Current Date</p>
              <p className="text-sm font-semibold">{format(new Date(), 'MMMM d, yyyy')}</p>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <DashboardView transactions={transactions} employees={employees} />}
            {activeTab === 'transactions' && <TransactionsView transactions={transactions} employees={employees} />}
            {activeTab === 'reports' && <ReportsView transactions={transactions} employees={employees} filters={filters} setFilters={setFilters} />}
            {activeTab === 'employees' && <EmployeesView employees={employees} />}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
        active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

// --- Views ---

function DashboardView({ transactions, employees }: { transactions: Transaction[], employees: Employee[] }) {
  const stats = useMemo(() => {
    const totalBalance = employees.reduce((acc, emp) => acc + emp.balance, 0);
    const monthStart = startOfMonth(new Date());
    const monthlyIncome = transactions
      .filter(t => new Date(t.date) >= monthStart && (t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In'))
      .reduce((acc, t) => acc + t.amount, 0);
    const monthlyExpense = transactions
      .filter(t => new Date(t.date) >= monthStart && (t.type === 'Expense' || t.type === 'Transfer-Out' || t.type === 'Accrual-Out'))
      .reduce((acc, t) => acc + t.amount, 0);

    return { totalBalance, monthlyIncome, monthlyExpense };
  }, [transactions, employees]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return format(d, 'yyyy-MM-dd');
    });

    return last7Days.map(date => {
      const dayTrans = transactions.filter(t => t.date === date);
      const income = dayTrans
        .filter(t => t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In')
        .reduce((acc, t) => acc + t.amount, 0);
      const expense = dayTrans
        .filter(t => t.type === 'Expense' || t.type === 'Transfer-Out' || t.type === 'Accrual-Out')
        .reduce((acc, t) => acc + t.amount, 0);
      return { name: format(parseISO(date), 'EEE'), income, expense };
    });
  }, [transactions]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'Expense')
      .forEach(t => {
        cats[t.category] = (cats[t.category] || 0) + t.amount;
      });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Balance" value={stats.totalBalance} icon={<Wallet className="text-indigo-600" />} trend="+2.4%" />
        <StatCard title="Monthly Income" value={stats.monthlyIncome} icon={<ArrowUpRight className="text-emerald-600" />} trend="+12%" />
        <StatCard title="Monthly Expenses" value={stats.monthlyExpense} icon={<ArrowDownLeft className="text-rose-600" />} trend="-5%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-600" />
            Weekly Activity
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Filter size={20} className="text-indigo-600" />
            Expenses by Category
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#ec4899'][index % 6]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
          <button className="text-sm text-indigo-600 font-medium hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.slice(0, 5).map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{t.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{t.employee}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      (t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In') ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{t.category}</td>
                  <td className={cn(
                    "px-6 py-4 text-sm font-bold text-right data-value",
                    (t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In') ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {(t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In') ? '+' : '-'}
                    {t.amount.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: number, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
        <span className={cn("text-xs font-bold px-2 py-1 rounded-lg", trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
          {trend}
        </span>
      </div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <p className="text-3xl font-bold mt-1 data-value">{value.toFixed(3)} <span className="text-sm font-normal text-slate-400">KWD</span></p>
    </div>
  );
}

function TransactionsView({ transactions, employees }: { transactions: Transaction[], employees: Employee[] }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    employee: '',
    receiver: '', // for transfers
    branch: BRANCHES[0],
    type: 'Expense' as Transaction['type'],
    category: CATEGORIES[0],
    amount: '',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || !formData.employee) return;

    try {
      if (formData.type === 'Transfer-Out') {
        const transferId = `TR-${Date.now()}`;
        // Add Outgoing
        await addDoc(collection(db, 'transactions'), {
          ...formData,
          amount: amountNum,
          type: 'Transfer-Out',
          relatedId: transferId,
          timestamp: Timestamp.now()
        });
        // Add Incoming for receiver
        await addDoc(collection(db, 'transactions'), {
          ...formData,
          employee: formData.receiver,
          amount: amountNum,
          type: 'Transfer-In',
          relatedId: transferId,
          timestamp: Timestamp.now(),
          description: `From: ${formData.employee} - ${formData.description}`
        });

        // Update balances
        const sender = employees.find(e => e.name === formData.employee);
        const receiver = employees.find(e => e.name === formData.receiver);
        if (sender) await updateDoc(doc(db, 'employees', sender.id), { balance: increment(-amountNum) });
        if (receiver) await updateDoc(doc(db, 'employees', receiver.id), { balance: increment(amountNum) });

      } else {
        await addDoc(collection(db, 'transactions'), {
          ...formData,
          amount: amountNum,
          timestamp: Timestamp.now()
        });

        const emp = employees.find(e => e.name === formData.employee);
        if (emp) {
          const isCredit = formData.type === 'Income' || formData.type === 'Accrual-In';
          await updateDoc(doc(db, 'employees', emp.id), { balance: increment(isCredit ? amountNum : -amountNum) });
        }
      }

      setShowForm(false);
      setFormData({ ...formData, amount: '', description: '' });
    } catch (error) {
      console.error("Failed to add transaction", error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search transactions..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
        >
          <PlusCircle size={20} />
          New Transaction
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">Date</th>
              <th className="px-6 py-4 font-semibold">Employee</th>
              <th className="px-6 py-4 font-semibold">Branch</th>
              <th className="px-6 py-4 font-semibold">Type</th>
              <th className="px-6 py-4 font-semibold">Category</th>
              <th className="px-6 py-4 font-semibold text-right">Amount</th>
              <th className="px-6 py-4 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map(t => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-600">{t.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{t.employee}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{t.branch}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                    (t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In') ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  )}>
                    {t.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{t.category}</td>
                <td className={cn(
                  "px-6 py-4 text-sm font-bold text-right data-value",
                  (t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In') ? "text-emerald-600" : "text-rose-600"
                )}>
                  {(t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In') ? '+' : '-'}
                  {t.amount.toFixed(3)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 italic max-w-xs truncate">{t.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-2xl font-bold text-slate-800">New Transaction</h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                  <PlusCircle size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Date</label>
                    <input 
                      type="date" 
                      required
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Branch</label>
                    <select 
                      value={formData.branch}
                      onChange={e => setFormData({...formData, branch: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Type</label>
                    <select 
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value as any})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="Income">Income (وارد)</option>
                      <option value="Expense">Expense (صادر)</option>
                      <option value="Transfer-Out">Transfer (تحويل)</option>
                      <option value="Accrual-In">Accrual Receivable (استحقاق لنا)</option>
                      <option value="Accrual-Out">Accrual Payable (استحقاق علينا)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Category</label>
                    <select 
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{formData.type === 'Transfer-Out' ? 'Sender' : 'Employee'}</label>
                    <select 
                      required
                      value={formData.employee}
                      onChange={e => setFormData({...formData, employee: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">Select Employee</option>
                      {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                    </select>
                  </div>
                  {formData.type === 'Transfer-Out' && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Receiver</label>
                      <select 
                        required
                        value={formData.receiver}
                        onChange={e => setFormData({...formData, receiver: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">Select Receiver</option>
                        {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Amount (KWD)</label>
                    <input 
                      type="number" 
                      step="0.001"
                      required
                      placeholder="0.000"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none data-value"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Description</label>
                  <textarea 
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Enter details..."
                  />
                </div>
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-3 px-6 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-6 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                  >
                    Save Transaction
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ReportsView({ transactions, employees, filters, setFilters }: { transactions: Transaction[], employees: Employee[], filters: any, setFilters: any }) {
  const reportData = useMemo(() => {
    let filtered = transactions.filter(t => {
      const isWithinDate = isWithinInterval(parseISO(t.date), {
        start: parseISO(filters.startDate),
        end: parseISO(filters.endDate)
      });
      const empMatch = filters.employee === 'all' || t.employee === filters.employee;
      const branchMatch = filters.branch === 'all' || t.branch === filters.branch;
      const catMatch = filters.category === 'all' || t.category === filters.category;
      const typeMatch = filters.type === 'all' || 
        (filters.type === 'income' && (t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In')) ||
        (filters.type === 'expense' && (t.type === 'Expense' || t.type === 'Transfer-Out' || t.type === 'Accrual-Out'));

      return isWithinDate && empMatch && branchMatch && catMatch && typeMatch;
    });

    // Sort by date ascending for running balance
    filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    // Calculate opening balance (all transactions before start date)
    const openingBalance = transactions
      .filter(t => {
        const isBefore = new Date(t.date) < parseISO(filters.startDate);
        const empMatch = filters.employee === 'all' || t.employee === filters.employee;
        const branchMatch = filters.branch === 'all' || t.branch === filters.branch;
        return isBefore && empMatch && branchMatch;
      })
      .reduce((acc, t) => {
        const isCredit = t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In';
        return acc + (isCredit ? t.amount : -t.amount);
      }, 0);

    runningBalance = openingBalance;

    const rows = filtered.map(t => {
      const isCredit = t.type === 'Income' || t.type === 'Transfer-In' || t.type === 'Accrual-In';
      runningBalance += isCredit ? t.amount : -t.amount;
      return { ...t, isCredit, runningBalance };
    });

    return { rows, openingBalance, finalBalance: runningBalance };
  }, [transactions, filters]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Date</label>
          <input 
            type="date" 
            value={filters.startDate}
            onChange={e => setFilters({...filters, startDate: e.target.value})}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End Date</label>
          <input 
            type="date" 
            value={filters.endDate}
            onChange={e => setFilters({...filters, endDate: e.target.value})}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee</label>
          <select 
            value={filters.employee}
            onChange={e => setFilters({...filters, employee: e.target.value})}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Employees</option>
            {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Branch</label>
          <select 
            value={filters.branch}
            onChange={e => setFilters({...filters, branch: e.target.value})}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Branches</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
          <select 
            value={filters.category}
            onChange={e => setFilters({...filters, category: e.target.value})}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button className="w-full py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Report Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
          <p className="text-indigo-600 text-xs font-bold uppercase tracking-wider">Opening Balance</p>
          <p className="text-2xl font-bold text-indigo-900 data-value mt-1">{reportData.openingBalance.toFixed(3)}</p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
          <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider">Total Movement</p>
          <p className="text-2xl font-bold text-emerald-900 data-value mt-1">{(reportData.finalBalance - reportData.openingBalance).toFixed(3)}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-white">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Final Balance</p>
          <p className="text-2xl font-bold data-value mt-1">{reportData.finalBalance.toFixed(3)}</p>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold">Branch</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold text-right">In (وارد)</th>
                <th className="px-6 py-4 font-semibold text-right">Out (صادر)</th>
                <th className="px-6 py-4 font-semibold text-right">Balance</th>
                <th className="px-6 py-4 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.rows.map((t, idx) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{t.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{t.employee}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{t.branch}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      t.isCredit ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{t.category}</td>
                  <td className="px-6 py-4 text-sm font-bold text-right text-emerald-600 data-value">
                    {t.isCredit ? t.amount.toFixed(3) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-right text-rose-600 data-value">
                    {!t.isCredit ? t.amount.toFixed(3) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 data-value">
                    {t.runningBalance.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 italic max-w-xs truncate">{t.description}</td>
                </tr>
              ))}
              {reportData.rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">No transactions found for the selected criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function EmployeesView({ employees }: { employees: Employee[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await addDoc(collection(db, 'employees'), {
        name: newName.trim(),
        balance: 0,
        status: 'Active'
      });
      setNewName('');
      setShowAdd(false);
    } catch (error) {
      console.error("Failed to add employee", error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-slate-800">Employee Management</h3>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
        >
          <PlusCircle size={20} />
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map(emp => (
          <div key={emp.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-lg">
                {emp.name.charAt(0)}
              </div>
              <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded-lg">
                {emp.status}
              </span>
            </div>
            <h4 className="text-lg font-bold text-slate-900">{emp.name}</h4>
            <p className="text-slate-500 text-sm">Current Balance</p>
            <p className={cn("text-2xl font-bold mt-1 data-value", emp.balance >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {emp.balance.toFixed(3)} <span className="text-sm font-normal text-slate-400">KWD</span>
            </p>
            <div className="mt-6 pt-6 border-t border-slate-100 flex gap-2">
              <button className="flex-1 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">History</button>
              <button className="flex-1 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">Edit</button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdd(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <h3 className="text-xl font-bold mb-6">Add New Employee</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Full Name</label>
                  <input 
                    type="text" 
                    required
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Enter employee name"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="flex-1 py-2 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all"
                  >
                    Add
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
