import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Key, 
  AlertCircle, 
  CheckCircle2, 
  Wallet, 
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthManagerProps {
  onEmailAuth: (email: string, pass: string, isSignUp: boolean) => Promise<{ success: boolean; error?: string; message?: string }>;
  onGoogleLogin: () => Promise<void>;
  onBypassLogin: () => void;
  gasConnected: boolean | null;
  gasChecking: boolean;
  onRetryGas: () => void;
}

export default function AuthManager({
  onEmailAuth,
  onGoogleLogin,
  onBypassLogin,
  gasConnected,
  gasChecking,
  onRetryGas
}: AuthManagerProps) {
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    try {
      const res = await onEmailAuth(email, password, isSignUp);
      if (res.success) {
        if (res.message) setAuthSuccess(res.message);
      } else {
        setAuthError(res.error || 'فشلت عملية المصادقة');
      }
    } catch (err: any) {
      setAuthError(err.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans" dir="rtl">
      {/* Background Decorative Rings */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        {/* Logo and Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
            <Wallet size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">KWD Finance</h1>
          <p className="text-sm font-bold text-slate-400 mt-1">نظام إدارة العهد والمصروفات النقدية والتدقيق المالي</p>
          
          {/* Status Indicator */}
          <div className="mt-4 flex items-center gap-2">
            {gasChecking ? (
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-ping"></span>
                جاري فحص الاتصال بالخادم...
              </span>
            ) : gasConnected ? (
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                قاعدة البيانات السحابية متصلة وجاهزة
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  وضع الاستعداد / وضع العمل بدون إنترنت
                </span>
                <button 
                  onClick={onRetryGas}
                  className="text-[11px] font-bold text-slate-400 hover:text-white underline cursor-pointer"
                >
                  إعادة فحص
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error and Success Notifications */}
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
        <form onSubmit={handleSubmit} className="space-y-4">
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
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setAuthError(null);
              setAuthSuccess(null);
            }}
            className="text-xs text-slate-400 hover:text-emerald-400 font-bold transition-colors cursor-pointer"
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
            type="button"
            onClick={onGoogleLogin}
            disabled={authLoading}
            className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 text-sm border border-slate-200 cursor-pointer"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            الدخول السريع بحساب Google
          </button>

          <button 
            type="button"
            onClick={onBypassLogin}
            className="w-full py-3 px-4 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 text-sm border border-emerald-500/20 cursor-pointer"
          >
            <Zap size={16} />
            <span>الدخول التجريبي الفوري (مسؤول) ⚡</span>
          </button>

          <div className="text-center">
            <span className="text-[10px] text-slate-500 font-medium leading-relaxed block">
              ملاحظة: الدخول التجريبي يتيح اختبار جميع المزايا والطباعة دون قيود المتصفح على النوافذ المنبثقة.
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
