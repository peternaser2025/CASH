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
  Users,
  Coins
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
        <div className="p-8 flex items-center justify-between border-b border-white/5">
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <Coins size={24} />
              </div>
              <h1 className="text-xl font-black tracking-tighter text-white">
                KWD FINANCE <span className="text-emerald-400">PRO</span>
              </h1>
            </motion.div>
          )}
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white active:scale-90"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 group ${
                activeView === item.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${
                activeView === item.id ? 'bg-white/20' : 'bg-transparent group-hover:bg-white/10'
              }`}>
                <item.icon size={20} />
              </div>
              {isSidebarOpen && (
                <span className="font-black text-sm uppercase tracking-widest">{item.label}</span>
              )}
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
      <main className={`flex-1 transition-all duration-500 ${isSidebarOpen ? 'mr-64' : 'mr-20'} p-10 print:mr-0 print:p-0 bg-[#F8F9FA]`}>
        {(!(import.meta as any).env.VITE_GAS_URL || (import.meta as any).env.VITE_GAS_URL.includes('...')) && (
          <div className="mb-10 p-6 bg-amber-50 border border-amber-100 rounded-[2rem] flex items-center gap-4 text-amber-800 shadow-xl shadow-amber-500/5">
            <div className="p-3 bg-amber-500 text-white rounded-2xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="font-black text-lg">تنبيه: رابط السيرفر غير مفعل</p>
              <p className="text-sm font-medium opacity-80">يرجى ضبط رابط Google Apps Script في ملف .env لتفعيل النظام.</p>
            </div>
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
              <ReportViewer 
                employees={balances.map(b => b.name)} 
                balances={balances}
              />
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
