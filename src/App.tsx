import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Users, 
  LogOut,
  Wallet,
  Lock,
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Key,
  Cloud,
  TrendingUp,
  ShieldAlert,
  Search,
  Receipt,
  BellRing,
  ShieldCheck,
  Menu,
  X,
  ChevronLeft,
  FileCheck2,
  BookOpen,
  Target,
  Truck
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

// Importing beautiful Arabic sub-components
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import ReportViewer from './components/ReportViewer';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new-transaction' | 'reports' | 'settlements' | 'orders' | 'journal-entries' | 'budgets' | 'employees' | 'google-tools' | 'profit-loss' | 'cost-control' | 'accruals' | 'global-search' | 'data-integrity'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // App Data State
  const [balances, setBalances] = useState<EmployeeBalance[]>([]);
  const [branches, setBranches] = useState<string[]>(BRANCHES);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [loadingData, setLoadingData] = useState(false);
  const [prefilledEmployee, setPrefilledEmployee] = useState<string | undefined>(undefined);

  const activeCustodyAlertsCount = useMemo(() => {
    let savedThreshold = 50;
    try {
      const saved = localStorage.getItem('custody_alert_threshold');
      if (saved) savedThreshold = parseFloat(saved);
    } catch {}
    return balances.filter(b => b.balance <= savedThreshold).length;
  }, [balances]);

  // Email/Password login fields
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

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
    // فحص الاتصال بـ Google Sheets تلقائياً
    checkGasConnection();

    // تلقين وحقن حساب الآدمن تلقائياً في الشيت بمجرد تشغيل التطبيق لضمان فعاليته
    const seedAdminAutomatically = async () => {
      try {
        await gasService.addUser('peter_naser@yahoo.com', 'P0182671648n$', 'المدير العام (مسؤول)', 'admin');
        console.log("Admin account fed to GAS automatically on mount!");
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

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
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
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError("نطاق التطبيق (Domain) غير مضاف في قائمة النطاقات المصرح بها لـ Google OAuth في Firebase Console. يمكنك تسجيل الدخول بـ (admin / admin) أو عبر زر 'الدخول التجريبي الفوري' بالأسفل.");
      } else if (error.code === 'auth/popup-blocked') {
        setAuthError("تم حظر نافذة تسجيل الدخول المنبثقة من قبل المتصفح. يرجى استخدام تسجيل الدخول بالبريد الإلكتروني أو فتح التطبيق في نافذة جديدة.");
      } else {
        setAuthError("فشل تسجيل الدخول باستخدام Google (" + (error.code || error.message) + "). يرجى استخدام اسم المستخدم وكلمة المرور (admin / admin) أو الدخول التجريبي الفوري.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    // الدخول بـ admin / admin كمسار افتراضي سريع وفوري ومضمون 100%
    if (email.trim().toLowerCase() === 'admin' && password === 'admin') {
      const gasUser = {
        email: 'peter_naser@yahoo.com',
        displayName: 'المدير العام (مسؤول)',
        photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
        isGAS: true
      };
      localStorage.setItem('gas_user_session', JSON.stringify(gasUser));
      setUser(gasUser);
      setAuthSuccess("تم تسجيل الدخول بنجاح كمسؤول (admin)!");
      setAuthLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        try {
          await gasService.addUser(email, password, 'المدير العام (مسؤول)', 'admin');
        } catch (gasErr) {
          console.warn("Failed to write credentials to Google Sheet", gasErr);
        }
        setAuthSuccess("تم إنشاء الحساب بنجاح وتجهيز النظام وربطه بـ Google Sheets!");
      } else {
        // Try to authenticate via Google Sheets first
        let gasSuccess = false;
        try {
          const gasResult = await gasService.checkLogin(email, password);
          if (gasResult && gasResult.success) {
            const gasUser = {
              email,
              displayName: gasResult.displayName || 'المدير العام (مسؤول)',
              photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
              isGAS: true
            };
            localStorage.setItem('gas_user_session', JSON.stringify(gasUser));
            setUser(gasUser);
            setAuthSuccess("تم تسجيل الدخول بنجاح عبر قاعدة بيانات Excel (جوجل شيت)!");
            gasSuccess = true;
          } else if (gasResult && gasResult.error && gasResult.error.includes("غير صحيحة")) {
            // If GAS explicitly rejected the credentials (wrong username or password), display it and return.
            setAuthError(gasResult.error);
            return;
          } else {
            console.warn("GAS login check indicated not active or failed, falling back to Firebase Auth", gasResult ? gasResult.error : "Unknown");
          }
        } catch (gasErr) {
          console.warn("GAS login check failed, falling back to Firebase Auth", gasErr);
        }

        if (!gasSuccess) {
          // Fallback to standard Firebase Authentication
          await signInWithEmailAndPassword(auth, email, password);
        }
      }
    } catch (error: any) {
      console.error("Email auth failed", error);
      let arabicMessage = "حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.";
      if (error.code === 'auth/wrong-password') {
        arabicMessage = "كلمة المرور غير صحيحة.";
      } else if (error.code === 'auth/user-not-found') {
        arabicMessage = "البريد الإلكتروني غير مسجل في النظام. يرجى إنشاء حساب جديد.";
      } else if (error.code === 'auth/email-already-in-use') {
        arabicMessage = "البريد الإلكتروني مستخدم بالفعل.";
      } else if (error.code === 'auth/weak-password') {
        arabicMessage = "كلمة المرور ضعيفة جداً (يجب أن لا تقل عن 6 خانات).";
      } else if (error.code === 'auth/invalid-email') {
        arabicMessage = "صيغة البريد الإلكتروني غير صحيحة.";
      }
      setAuthError(arabicMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  // Direct bypass for preview testing (iframe compatibility)
  const handleBypassLogin = () => {
    setUser({
      email: 'peter_naser@yahoo.com',
      displayName: 'المدير العام (مسؤول)',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('gas_user_session');
    signOut(auth).then(() => {
      setUser(null);
    }).catch(() => {
      setUser(null);
    });
  };

  const employeeNames = useMemo(() => balances.map(b => b.name), [balances]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600 mb-4"></div>
        <p className="text-gray-600 font-bold">جاري تحميل النظام المالي...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-gray-950 p-4" dir="rtl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl shadow-emerald-950/20 p-8 md:p-10 z-10"
        >
          {/* Logo Section */}
          <div className="text-center space-y-4 mb-6">
            <div className="inline-flex p-4 bg-emerald-600/10 text-emerald-400 rounded-3xl border border-emerald-500/20 shadow-inner">
              <Wallet size={40} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">KWD Finance Pro</h1>
              <p className="mt-2 text-slate-400 text-sm font-medium">نظام العهد النقدية والمصروفات الموحد للشركات</p>
            </div>

            {/* Live Google Sheets Connection Status */}
            <div className="mt-4 flex flex-col items-center justify-center gap-1 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">حالة الاتصال بـ Google Sheets (الاكسيل):</span>
              {gasChecking ? (
                <div className="flex items-center gap-2 text-slate-300 text-[11px] font-bold animate-pulse">
                  <div className="w-2.5 h-2.5 border-2 border-slate-300 border-b-transparent rounded-full animate-spin"></div>
                  جاري فحص الاتصال...
                </div>
              ) : gasConnected === true ? (
                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-black">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  مربوط بنجاح بالاكسيل وقاعده البيانات نشطة ✅
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <button 
                    type="button"
                    onClick={checkGasConnection}
                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/20 text-[10px] font-black transition-all cursor-pointer"
                  >
                    ⚠️ اضغط هنا لفحص الاتصال بـ Google Sheets
                  </button>
                  <p className="text-[9px] text-slate-600 max-w-xs text-center leading-relaxed">
                    تأكد من نشر الـ Web App الخاص بـ Google Apps Script كـ Anyone.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error and Success States */}
          <AnimatePresence mode="wait">
            {authError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-4 mb-6 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl flex items-center gap-3 text-xs font-bold leading-relaxed"
              >
                <AlertCircle className="shrink-0" size={18} />
                <p>{authError}</p>
              </motion.div>
            )}
            {authSuccess && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-4 mb-6 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-xs font-bold leading-relaxed"
              >
                <CheckCircle2 className="shrink-0" size={18} />
                <p>{authSuccess}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 tracking-wider">اسم المستخدم أو البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text"
                  required
                  placeholder="admin"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-white text-sm font-semibold transition-all placeholder:text-slate-700"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 tracking-wider">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pr-12 pl-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-white text-sm font-semibold transition-all placeholder:text-slate-700"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={authLoading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-white border-b-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Key size={18} />
                  {isSignUp ? "إنشاء حساب جديد وتثبيت كمسؤول" : "تسجيل دخول كمسؤول"}
                </>
              )}
            </button>
          </form>

          {/* Toggle between Sign In & Sign Up */}
          <div className="text-center mt-4">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
                setAuthSuccess(null);
              }}
              className="text-xs text-slate-400 hover:text-emerald-400 font-bold transition-colors"
            >
              {isSignUp ? "هل لديك حساب بالفعل؟ تسجيل الدخول" : "ليس لديك حساب؟ إنشاء حساب للمسؤول"}
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <hr className="border-slate-800" />
            <span className="absolute top-1/2 -translate-y-1/2 bg-slate-900 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">أو الطرق البديلة</span>
          </div>

          {/* Alternative login methods (Google and Quick Tester Bypass) */}
          <div className="space-y-3">
            <button 
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 text-sm border border-slate-200"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              الدخول السريع بحساب Google
            </button>

            <button 
              onClick={handleBypassLogin}
              className="w-full py-3 px-4 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 text-sm border border-emerald-500/20"
            >
              <span>الدخول التجريبي الفوري (مسؤول) ⚡</span>
            </button>

            <div className="text-center">
              <span className="text-[10px] text-slate-500 font-medium">ملاحظة: الدخول التجريبي يتيح اختبار جميع المزايا والطباعة دون قيود المتصفح على النوافذ المنبثقة.</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const navigateTo = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const getSectionTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'المركز المالي للعهد والسيولة';
      case 'new-transaction': return 'تسجيل حركة مالية جديدة';
      case 'reports': return 'تقارير وكشوف الحسابات';
      case 'settlements': return 'محاضر جرد وتصفية وتسوية العهدة النقدية';
      case 'orders': return 'متابعة الطلبيات ومواعيد الاستحقاق والتسليم';
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
    if (['dashboard', 'new-transaction', 'reports', 'settlements', 'orders'].includes(activeTab)) return 'العمليات والتقارير';
    if (['journal-entries', 'budgets', 'profit-loss', 'cost-control', 'accruals', 'global-search'].includes(activeTab)) return 'الرقابة والتحليل';
    return 'النظام والإدارة';
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" dir="rtl">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Structured Enterprise Arabic Navigation */}
      <aside className={`
        fixed md:static inset-y-0 right-0 z-50 w-72 lg:w-80 bg-slate-950 text-slate-100 flex flex-col shrink-0 border-l border-slate-900 no-print transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-6 lg:p-7 flex items-center justify-between border-b border-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/15">
              <Wallet size={22} className="text-white" />
            </div>
            <div>
              <span className="font-black text-lg lg:text-xl tracking-tight text-white">KWD Finance</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">النظام المالي الذكي</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900"
          >
            <X size={20} />
          </button>
        </div>

        {/* Structured Sidebar Navigation */}
        <nav className="flex-1 px-3.5 py-6 space-y-6 overflow-y-auto">
          {/* Group 1: Daily Operations & Statements */}
          <div className="space-y-1.5">
            <div className="px-3.5 pb-1 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <span>العمليات والتقارير</span>
              <span className="text-[9px] text-slate-600 font-mono">01</span>
            </div>
            <SidebarItem 
              icon={<LayoutDashboard size={18} />} 
              label="المركز المالي للعهد" 
              active={activeTab === 'dashboard'} 
              badge={activeCustodyAlertsCount > 0 ? `${activeCustodyAlertsCount} تنبيه` : undefined}
              badgeType={activeCustodyAlertsCount > 0 ? 'warning' : 'default'}
              onClick={() => navigateTo('dashboard')} 
            />
            <SidebarItem 
              icon={<PlusCircle size={18} />} 
              label="تسجيل حركة مالية" 
              active={activeTab === 'new-transaction'} 
              badge="جديد +"
              badgeType="success"
              onClick={() => navigateTo('new-transaction')} 
            />
            <SidebarItem 
              icon={<FileText size={18} />} 
              label="كشف الحساب والعمليات" 
              active={activeTab === 'reports'} 
              onClick={() => navigateTo('reports')} 
            />
            <SidebarItem 
              icon={<FileCheck2 size={18} />} 
              label="محاضر جرد وتصفية العهد" 
              active={activeTab === 'settlements'} 
              badge="رسمي"
              badgeType="neutral"
              onClick={() => navigateTo('settlements')} 
            />
            <SidebarItem 
              icon={<Truck size={18} />} 
              label="متابعة الطلبيات والمواعيد" 
              active={activeTab === 'orders'} 
              badge="جديد"
              badgeType="success"
              onClick={() => navigateTo('orders')} 
            />
          </div>

          {/* Group 2: Financial Control & Auditing */}
          <div className="space-y-1.5">
            <div className="px-3.5 pb-1 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <span>الرقابة والتحليل المالي</span>
              <span className="text-[9px] text-slate-600 font-mono">02</span>
            </div>
            <SidebarItem 
              icon={<BookOpen size={18} />} 
              label="دفتر القيود المحاسبية (Dr/Cr)" 
              active={activeTab === 'journal-entries'} 
              badge="مزدوج"
              badgeType="success"
              onClick={() => navigateTo('journal-entries')} 
            />
            <SidebarItem 
              icon={<Target size={18} />} 
              label="سقف الموازنات والانحرافات" 
              active={activeTab === 'budgets'} 
              onClick={() => navigateTo('budgets')} 
            />
            <SidebarItem 
              icon={<TrendingUp size={18} />} 
              label="الأرباح والخسائر بالفروع" 
              active={activeTab === 'profit-loss'} 
              onClick={() => navigateTo('profit-loss')} 
            />
            <SidebarItem 
              icon={<ShieldAlert size={18} />} 
              label="رادار ضبط التكاليف والهدر" 
              active={activeTab === 'cost-control'} 
              onClick={() => navigateTo('cost-control')} 
            />
            <SidebarItem 
              icon={<Receipt size={18} />} 
              label="المشتريات الآجلة والالتزامات" 
              active={activeTab === 'accruals'} 
              onClick={() => navigateTo('accruals')} 
            />
            <SidebarItem 
              icon={<Search size={18} />} 
              label="محرك البحث والتدقيق الشامل" 
              active={activeTab === 'global-search'} 
              onClick={() => navigateTo('global-search')} 
            />
          </div>

          {/* Group 3: Administration & Cloud Tools */}
          <div className="space-y-1.5">
            <div className="px-3.5 pb-1 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <span>النظام والإدارة السحابية</span>
              <span className="text-[9px] text-slate-600 font-mono">03</span>
            </div>
            <SidebarItem 
              icon={<Users size={18} />} 
              label="إدارة الموظفين والعهد" 
              active={activeTab === 'employees'} 
              badge={`${balances.length}`}
              badgeType="neutral"
              onClick={() => navigateTo('employees')} 
            />
            <SidebarItem 
              icon={<ShieldCheck size={18} />} 
              label="أمان وحفظ البيانات والنسخ" 
              active={activeTab === 'data-integrity'} 
              onClick={() => navigateTo('data-integrity')} 
            />
            <SidebarItem 
              icon={<Cloud size={18} />} 
              label="أدوات Google Workspace" 
              active={activeTab === 'google-tools'} 
              badge={gasConnected ? "متصل" : "إعداد"}
              badgeType={gasConnected ? "success" : "neutral"}
              onClick={() => navigateTo('google-tools')} 
            />
          </div>
        </nav>

        {/* User profile & Logout */}
        <div className="p-5 border-t border-slate-900 bg-slate-950/60">
          <div className="flex items-center gap-3 mb-4 px-1">
            <img 
              src={user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'} 
              className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 shrink-0" 
              alt="User" 
            />
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate">{user.displayName || 'مسؤول النظام'}</p>
              <p className="text-[10px] text-slate-500 font-bold truncate mt-0.5">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-slate-900 hover:border-red-500/20 transition-all font-black duration-200"
          >
            <LogOut size={14} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-y-auto print:bg-white print:overflow-visible">
        {/* Header - Hidden on Print */}
        <header className="h-20 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-8 lg:px-10 sticky top-0 z-40 no-print shrink-0 shadow-sm/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl"
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
                className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-emerald-600/20"
              >
                <PlusCircle size={15} />
                <span>حركة جديدة</span>
              </button>
            )}

            {/* Quick Search Button */}
            {activeTab !== 'global-search' && (
              <button
                onClick={() => setActiveTab('global-search')}
                className="p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
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

function SidebarItem({ 
  icon, 
  label, 
  active, 
  badge,
  badgeType = 'default',
  onClick 
}: { 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  badge?: string,
  badgeType?: 'default' | 'success' | 'warning' | 'neutral',
  onClick: () => void 
}) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 font-black text-xs relative group ${
        active 
          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" 
          : "text-slate-400 hover:text-white hover:bg-slate-900/70"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={active ? "text-white" : "text-slate-400 group-hover:text-emerald-400 transition-colors"}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>

      {badge && (
        <span className={`text-[10px] px-2 py-0.5 rounded-md font-black shrink-0 ${
          active 
            ? "bg-emerald-700/80 text-emerald-100" 
            : badgeType === 'success'
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : badgeType === 'warning'
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                : "bg-slate-800 text-slate-300"
        }`}>
          {badge}
        </span>
      )}

      {active && (
        <motion.div 
          layoutId="activeIndicator"
          className="absolute right-0 top-1/4 h-1/2 w-1 bg-white rounded-l-full"
        />
      )}
    </button>
  );
}
