import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Settings, 
  Wallet, 
  ArrowRightLeft, 
  TrendingUp, 
  TrendingDown,
  Printer,
  Download,
  Menu,
  X,
  AlertCircle,
  Users
} from 'lucide-react';
import { gasService } from './services/gasService';
import { EmployeeBalance, Transaction, ReportFilter, ReportData } from './types';

// Components
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import ReportViewer from './components/ReportViewer';
import EmployeeManager from './components/EmployeeManager';

type View = 'dashboard' | 'transaction' | 'reports' | 'employees';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [balances, setBalances] = useState<EmployeeBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    setLoading(true);
    const data = await gasService.getBalances();
    setBalances(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'المركز المالي', icon: LayoutDashboard },
    { id: 'transaction', label: 'تسجيل عملية', icon: PlusCircle },
    { id: 'reports', label: 'كشف حساب', icon: FileText },
    { id: 'employees', label: 'إدارة الموظفين', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex text-right font-sans" dir="rtl">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-[#1A1C1E] text-white transition-all duration-300 flex flex-col fixed h-full z-50`}
      >
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xl font-bold tracking-tight text-emerald-400"
            >
              KWD Finance
            </motion.h1>
          )}
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeView === item.id 
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className={`flex items-center gap-3 ${isSidebarOpen ? 'px-2' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Settings size={16} />
            </div>
            {isSidebarOpen && (
              <div className="text-xs">
                <p className="text-white font-medium">النظام المحاسبي</p>
                <p className="text-gray-500">v1.0 Enterprise</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'mr-64' : 'mr-20'} p-8 print:mr-0 print:p-0`}>
        {(!(import.meta as any).env.VITE_GAS_URL || (import.meta as any).env.VITE_GAS_URL.includes('...')) && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
            <AlertCircle size={20} />
            <p className="text-sm">يرجى ضبط رابط Google Apps Script في ملف .env لتفعيل النظام.</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeView === 'dashboard' && (
              <Dashboard balances={balances} loading={loading} onRefresh={fetchBalances} />
            )}
            {activeView === 'transaction' && (
              <TransactionForm 
                employees={balances.map(b => b.name)}
                onComplete={() => {
                  fetchBalances();
                  setActiveView('dashboard');
                }} 
              />
            )}
            {activeView === 'reports' && (
              <ReportViewer employees={balances.map(b => b.name)} />
            )}
            {activeView === 'employees' && (
              <EmployeeManager balances={balances} onRefresh={fetchBalances} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
