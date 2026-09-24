import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusCircle, 
  RefreshCw, 
  Search, 
  BellRing, 
  Menu 
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User 
} from 'firebase/auth';
import { auth } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { gasService } from './services/gasService';
import { BRANCHES, CATEGORIES } from './constants';
import { EmployeeBalance } from './types';
import { workspaceService } from './services/workspaceService';

// Layout & Authentication
import Sidebar, { TabId } from './components/layout/Sidebar';
import AuthManager from './components/layout/AuthManager';

// Feature Components
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import ReportViewer from './components/ReportViewer';
import DailyJournal from './components/DailyJournal';
import EmployeeManager from './components/EmployeeManager';
import GoogleTools from './components/GoogleTools';
import ProfitLoss from './components/ProfitLoss';
import CostControl from './components/CostControl';
import AccrualLedger from './components/AccrualLedger';
import GlobalSearch from './components/GlobalSearch';
import DataIntegrityPanel from './components/DataIntegrityPanel';
import SettlementsManager from './components/SettlementsManager';
import JournalEntries from './components/JournalEntries';
import BudgetManager from './components/BudgetManager';
import OrdersManager from './components/OrdersManager';

export default function App() {
  const [user, setUser] = useState<User | any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // App Data State
  const [balances, setBalances] = useState<EmployeeBalance[]>([]);
  const [branches, setBranches] = useState<string[]>(BRANCHES);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [loadingData, setLoadingData] = useState(false);
  const [prefilledEmployee, setPrefilledEmployee] = useState<string | undefined>(undefined);

  // Custody Alert Threshold & Counter
  const activeCustodyAlertsCount = useMemo(() => {
    let savedThreshold = 50;
    try {
      const saved = localStorage.getItem('custody_alert_threshold');
      if (saved) savedThreshold = parseFloat(saved);
    } catch {}
    return balances.filter(b => b.balance <= savedThreshold).length;
  }, [balances]);

  // Live connection status with Google Sheets
  const [gasConnected, setGasConnected] = useState<boolean | null>(null);
  const [gasChecking, setGasChecking] = useState<boolean>(false);

  const checkGasConnection = async () => {
    setGasChecking(true);
    try {
      const url = gasService.getGasUrl();
      if (!url || url.includes('...')) {
        setGasConnected(false);
        setGasChecking(false);
        return;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(url, { 
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        setGasConnected(true);
      } else {
        setGasConnected(false);
      }
    } catch (err) {
      console.warn("GAS connection check failed:", err);
      setGasConnected(false);
    } finally {
      setGasChecking(false);
    }
  };

  // Monitor Authentication State and seed Admin automatically to GAS
  useEffect(() => {
    checkGasConnection();

    const seedAdminAutomatically = async () => {
      try {
        await gasService.addUser('daralsalam2factory@gmail.com', 'admin', 'المدير العام (مسؤول)', 'admin');
      } catch (err) {
        console.warn("Could not automatically seed admin account on mount:", err);
      }
    };
    seedAdminAutomatically();

    const savedGASUser = localStorage.getItem('gas_user_session');
    if (savedGASUser) {
      try {
        setUser(JSON.parse(savedGASUser));
        setLoading(false);
        return;
      } catch (e) {
        localStorage.removeItem('gas_user_session');
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!localStorage.getItem('gas_user_session')) {
        setUser(u);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fetch data from GAS Service
  const fetchData = async (forceRefresh: boolean = false) => {
    setLoadingData(true);
    try {
      const bData = await gasService.getBalances(forceRefresh);
      setBalances(bData);
      
      const settings = await gasService.getSettings();
      if (settings.branches && settings.branches.length > 0) {
        setBranches(settings.branches);
      }
      if (settings.categories && settings.categories.length > 0) {
        setCategories(settings.categories);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Google Login Handler
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    provider.addScope('https://www.googleapis.com/auth/drive');
    provider.addScope('https://www.googleapis.com/auth/documents');
    provider.addScope('https://www.googleapis.com/auth/tasks');
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        workspaceService.setAccessToken(credential.accessToken);
      }
    } catch (error: any) {
      console.error("Google login failed", error);
      let errMsg = "فشل تسجيل الدخول باستخدام Google (" + (error.code || error.message) + "). يرجى استخدام اسم المستخدم وكلمة المرور (admin / admin) أو الدخول التجريبي الفوري.";
      if (error.code === 'auth/unauthorized-domain') {
        errMsg = "نطاق التطبيق (Domain) غير مضاف في قائمة النطاقات المصرح بها لـ Google OAuth في Firebase Console. يمكنك تسجيل الدخول بـ (admin / admin) أو عبر زر 'الدخول التجريبي الفوري'.";
      } else if (error.code === 'auth/popup-blocked') {
        errMsg = "تم حظر نافذة تسجيل الدخول المنبثقة من قبل المتصفح. يرجى استخدام تسجيل الدخول بالبريد الإلكتروني أو فتح التطبيق في نافذة جديدة.";
      }
      throw new Error(errMsg);
    }
  };

  // Email / Password Authentication Handler
  const handleEmailAuth = async (emailInput: string, passwordInput: string, isSignUpMode: boolean): Promise<{ success: boolean; error?: string; message?: string }> => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      return { success: false, error: "يرجى كتابة اسم المستخدم/البريد وكلمة المرور" };
    }

    // Quick admin credentials
    if (emailInput.trim().toLowerCase() === 'admin' && passwordInput === 'admin') {
      const gasUser = {
        email: 'daralsalam2factory@gmail.com',
        displayName: 'المدير العام (مسؤول)',
        photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
        isGAS: true
      };
      localStorage.setItem('gas_user_session', JSON.stringify(gasUser));
      setUser(gasUser);
      return { success: true, message: "تم تسجيل الدخول بنجاح كمسؤول (admin)!" };
    }

    try {
      if (isSignUpMode) {
        await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        try {
          await gasService.addUser(emailInput, passwordInput, 'المدير العام (مسؤول)', 'admin');
        } catch (gasErr) {
          console.warn("Failed to write credentials to Google Sheet", gasErr);
        }
        return { success: true, message: "تم إنشاء الحساب بنجاح وتجهيز النظام وربطه بـ Google Sheets!" };
      } else {
        let gasSuccess = false;
        try {
          const gasResult = await gasService.checkLogin(emailInput, passwordInput);
          if (gasResult && gasResult.success) {
            const gasUser = {
              email: emailInput,
              displayName: gasResult.displayName || 'المدير العام (مسؤول)',
              photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
              isGAS: true
            };
            localStorage.setItem('gas_user_session', JSON.stringify(gasUser));
            setUser(gasUser);
            gasSuccess = true;
            return { success: true, message: "تم تسجيل الدخول بنجاح عبر قاعدة بيانات Excel (جوجل شيت)!" };
          } else if (gasResult && gasResult.error && gasResult.error.includes("غير صحيحة")) {
            return { success: false, error: gasResult.error };
          }
        } catch (gasErr) {
          console.warn("GAS login check failed, falling back to Firebase Auth", gasErr);
        }

        if (!gasSuccess) {
          await signInWithEmailAndPassword(auth, emailInput, passwordInput);
          return { success: true };
        }
      }
      return { success: true };
    } catch (error: any) {
      console.error("Email auth failed", error);
      let msg = "حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.";
      if (error.code === 'auth/wrong-password') {
        msg = "كلمة المرور غير صحيحة.";
      } else if (error.code === 'auth/user-not-found') {
        msg = "البريد الإلكتروني غير مسجل في النظام. يرجى إنشاء حساب جديد.";
      } else if (error.code === 'auth/email-already-in-use') {
        msg = "البريد الإلكتروني مستخدم بالفعل.";
      } else if (error.code === 'auth/weak-password') {
        msg = "كلمة المرور ضعيفة جداً (يجب أن لا تقل عن 6 خانات).";
      } else if (error.code === 'auth/invalid-email') {
        msg = "صيغة البريد الإلكتروني غير صحيحة.";
      }
      return { success: false, error: msg };
    }
  };

  // Tester Bypass
  const handleBypassLogin = () => {
    const adminUser = {
      email: 'daralsalam2factory@gmail.com',
      displayName: 'المدير العام (مسؤول)',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
      isGAS: true
    };
    localStorage.setItem('gas_user_session', JSON.stringify(adminUser));
    setUser(adminUser);
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('gas_user_session');
    signOut(auth).then(() => {
      setUser(null);
    }).catch(() => {
      setUser(null);
    });
  };

  const employeeNames = useMemo(() => balances.map(b => b.name), [balances]);

  const navigateTo = (tab: TabId) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600 mb-4"></div>
        <p className="text-gray-600 font-bold">جاري تحميل النظام المالي...</p>
      </div>
    );
  }

  // Render Authentication Modal if user not logged in
  if (!user) {
    return (
      <AuthManager 
        onEmailAuth={handleEmailAuth}
        onGoogleLogin={handleGoogleLogin}
        onBypassLogin={handleBypassLogin}
        gasConnected={gasConnected}
        gasChecking={gasChecking}
        onRetryGas={checkGasConnection}
      />
    );
  }

  const getSectionTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'المركز المالي الشامل وأرصدة العهد';
      case 'new-transaction': return 'تسجيل حركة مالية جديدة';
      case 'daily-journal': return 'دفتر اليومية المجمعة وحركة الصناديق';
      case 'reports': return 'كشف الحساب والعمليات التفصيلية';
      case 'settlements': return 'محاضر جرد وتصفية العهد النقدية';
      case 'orders': return 'إدارة ومتابعة طلبيات الموردين والعملاء';
      case 'journal-entries': return 'دفتر ومولد القيود المحاسبية اليومية المزدوجة';
      case 'budgets': return 'سقف الموازنات التقديرية وضبط الانحرافات';
      case 'employees': return 'إدارة الموظفين وصلاحيات العهد';
      case 'profit-loss': return 'حساب ومطابقة الأرباح والخسائر للفروع';
      case 'cost-control': return 'رادار ضبط التكاليف وكشف الهدر المالي';
      case 'accruals': return 'دفتر المشتريات الآجلة والالتزامات المستحقة';
      case 'global-search': return 'محرك البحث والتدقيق المالي الشامل';
      case 'data-integrity': return 'أمان وحفظ البيانات والنسخ الاحتياطي';
      case 'google-tools': return 'أدوات ومستندات Google Workspace السحابية';
      default: return 'النظام المالي والمحاسبي';
    }
  };

  const getSectionCategory = () => {
    if (['dashboard', 'new-transaction', 'reports', 'settlements', 'orders', 'daily-journal'].includes(activeTab)) return 'العمليات والتقارير';
    if (['journal-entries', 'budgets', 'profit-loss', 'cost-control', 'accruals', 'global-search'].includes(activeTab)) return 'الرقابة والتحليل';
    return 'النظام والإدارة';
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" dir="rtl">
      {/* Sidebar - Structured Enterprise Arabic Navigation */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={navigateTo}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        user={user}
        onLogout={handleLogout}
        activeCustodyAlertsCount={activeCustodyAlertsCount}
        balancesCount={balances.length}
        gasConnected={gasConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-y-auto print:bg-white print:overflow-visible">
        {/* Header - Hidden on Print */}
        <header className="h-20 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-8 lg:px-10 sticky top-0 z-40 no-print shrink-0 shadow-sm/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              <Menu size={22} />
            </button>
            <div className="w-1.5 h-7 bg-emerald-600 rounded-full"></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {getSectionCategory()}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">/</span>
                <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 truncate">
                  {getSectionTitle()}
                </h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Fast New Transaction Quick Button */}
            {activeTab !== 'new-transaction' && (
              <button
                onClick={() => setActiveTab('new-transaction')}
                className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
              >
                <PlusCircle size={15} />
                <span>حركة جديدة</span>
              </button>
            )}

            {/* Quick Search Button */}
            {activeTab !== 'global-search' && (
              <button
                onClick={() => setActiveTab('global-search')}
                className="p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="البحث والتدقيق الشامل"
              >
                <Search size={16} />
                <span className="hidden sm:inline">بحث وتدقيق</span>
              </button>
            )}

            {gasConnected === true ? (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-[11px] font-black">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                مربوط بالسحابة ✅
              </div>
            ) : gasConnected === false ? (
              <button 
                onClick={checkGasConnection}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-full border border-amber-200 text-[11px] font-black transition-all cursor-pointer"
              >
                ⚠️ مشكلة بالاتصال (إعادة المحاولة)
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-full border border-slate-200 text-[11px] font-bold animate-pulse">
                جاري التحقق...
              </div>
            )}

            {loadingData && (
              <div className="flex items-center gap-2 text-xs text-gray-500 font-bold bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 animate-pulse">
                <RefreshCw size={12} className="animate-spin text-emerald-500" />
                <span className="hidden md:inline">جاري التحديث...</span>
              </div>
            )}

            {/* Custody Alert Bell Notification */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className="relative p-2.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 rounded-2xl border border-slate-200 transition-all cursor-pointer group"
              title="رادار تنبيهات العهد والإشعار المسبق"
            >
              <BellRing size={18} className={activeCustodyAlertsCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-500'} />
              {activeCustodyAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center animate-bounce">
                  {activeCustodyAlertsCount}
                </span>
              )}
            </button>

            <div className="hidden xl:block text-left pr-2 border-r border-slate-200">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">اليوم والتاريخ</p>
              <p className="text-xs font-black text-gray-900 mt-0.5">
                {new Date().toLocaleDateString('ar-KW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </header>

        {/* Dynamic Views Panel */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1 print:p-0 print:max-w-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="print:p-0"
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  balances={balances} 
                  loading={loadingData} 
                  onRefresh={() => fetchData(true)}
                  onFeedCustody={(emp) => {
                    setPrefilledEmployee(emp);
                    setActiveTab('new-transaction');
                  }}
                  onViewReport={(emp) => {
                    setPrefilledEmployee(emp);
                    setActiveTab('reports');
                  }}
                />
              )}
              {activeTab === 'new-transaction' && (
                <TransactionForm 
                  onComplete={() => {
                    setPrefilledEmployee(undefined);
                    setActiveTab('reports');
                    fetchData(true);
                  }} 
                  employees={employeeNames} 
                  branches={branches} 
                  categories={categories}
                  initialEmployee={prefilledEmployee}
                  initialType={prefilledEmployee ? 'Transfer' : 'Expense'}
                />
              )}
              {activeTab === 'daily-journal' && (
                <DailyJournal 
                  balances={balances} 
                  branches={branches} 
                  categories={categories} 
                  employees={employeeNames} 
                  onRefresh={() => fetchData(true)}
                  onViewReport={(emp) => {
                    setPrefilledEmployee(emp);
                    setActiveTab('reports');
                  }}
                />
              )}
              {activeTab === 'reports' && (
                <ReportViewer 
                  employees={employeeNames} 
                  balances={balances} 
                  branches={branches} 
                  categories={categories} 
                  initialEmployee={prefilledEmployee}
                />
              )}
              {activeTab === 'settlements' && (
                <SettlementsManager 
                  balances={balances}
                  branches={branches}
                  categories={categories}
                  employees={employeeNames}
                  onRefresh={() => fetchData(true)}
                />
              )}
              {activeTab === 'orders' && (
                <OrdersManager 
                  branches={branches}
                  employees={employeeNames}
                  onRefresh={() => fetchData(true)}
                />
              )}
              {activeTab === 'journal-entries' && (
                <JournalEntries 
                  balances={balances}
                  branches={branches}
                  categories={categories}
                  employees={employeeNames}
                  onRefresh={() => fetchData(true)}
                />
              )}
              {activeTab === 'budgets' && (
                <BudgetManager 
                  branches={branches}
                  categories={categories}
                  onRefresh={() => fetchData(true)}
                />
              )}
              {activeTab === 'employees' && (
                <EmployeeManager 
                  balances={balances} 
                  onRefresh={() => fetchData(true)} 
                />
              )}
              {activeTab === 'profit-loss' && (
                <ProfitLoss 
                  branches={branches} 
                  categories={categories} 
                  balances={balances} 
                  onRefresh={() => fetchData(true)} 
                />
              )}
              {activeTab === 'cost-control' && (
                <CostControl 
                  branches={branches} 
                  categories={categories} 
                  onRefresh={() => fetchData(true)} 
                />
              )}
              {activeTab === 'accruals' && (
                <AccrualLedger 
                  branches={branches} 
                  categories={categories} 
                  employees={employeeNames} 
                  onRefresh={() => fetchData(true)} 
                />
              )}
              {activeTab === 'global-search' && (
                <GlobalSearch 
                  branches={branches} 
                  categories={categories} 
                  employees={employeeNames} 
                />
              )}
              {activeTab === 'data-integrity' && (
                <DataIntegrityPanel />
              )}
              {activeTab === 'google-tools' && (
                <GoogleTools 
                  balances={balances} 
                  onRefresh={fetchData} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
