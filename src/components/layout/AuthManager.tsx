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
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-[#E4E6EB] rounded-2xl p-7 lg:p-8 shadow-sm relative z-10 space-y-6"
      >
        {/* Brand Header - Facebook & eBay Modern Light Theme */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-[#1877F2] rounded-2xl flex items-center justify-center shadow-sm shadow-[#1877F2]/20 mb-3">
            <Wallet size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-[#050505] tracking-tight">KWD Finance Pro</h1>
          <p className="text-xs font-bold text-[#65676B] mt-1">منظومة الإدارة المالية والتدقيق الرقابي للشركات</p>
          
          {/* Cloud Connection Status Pill */}
          <div className="mt-3.5 flex items-center gap-2">
            {gasChecking ? (
              <span className="text-[11px] font-bold text-[#65676B] bg-[#F0F2F5] px-3 py-1 rounded-full border border-[#E4E6EB] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1877F2] animate-ping"></span>
                جاري فحص الاتصال بشيت جوجل...
              </span>
            ) : gasConnected ? (
              <span className="text-[11px] font-bold text-[#00875A] bg-[#E3FCEF] px-3 py-1 rounded-full border border-[#ABF5D1] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00875A]"></span>
                شيت جوجل متصل وجاهز للمزامنة
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#974F0C] bg-[#FFF0B3] px-3 py-1 rounded-full border border-[#FFE380] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FFAB00]"></span>
                  وضع الاستعداد / تشغيل محلي فوري
                </span>
                <button 
                  onClick={onRetryGas}
                  className="text-[11px] font-bold text-[#1877F2] hover:underline cursor-pointer"
                >
                  إعادة فحص
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <AnimatePresence mode="wait">
          {authError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-3.5 bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] rounded-xl flex items-center gap-3 text-xs font-bold"
            >
              <AlertCircle className="shrink-0 text-[#DC2626]" size={18} />
              <p>{authError}</p>
            </motion.div>
          )}
          {authSuccess && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-3.5 bg-[#E3FCEF] text-[#00875A] border border-[#ABF5D1] rounded-xl flex items-center gap-3 text-xs font-bold"
            >
              <CheckCircle2 className="shrink-0 text-[#00875A]" size={18} />
              <p>{authSuccess}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#050505]">اسم المستخدم أو البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" size={17} />
              <input 
                type="text"
                required
                placeholder="admin"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pr-11 pl-4 py-2.5 bg-[#F0F2F5] border border-[#CCD0D5] rounded-xl focus:bg-white focus:border-[#1877F2] focus:ring-2 focus:ring-[#1877F2]/15 outline-none text-[#050505] text-xs font-bold transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#050505]">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#65676B]" size={17} />
              <input 
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pr-11 pl-4 py-2.5 bg-[#F0F2F5] border border-[#CCD0D5] rounded-xl focus:bg-white focus:border-[#1877F2] focus:ring-2 focus:ring-[#1877F2]/15 outline-none text-[#050505] text-xs font-bold transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={authLoading}
            className="w-full py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-black text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {authLoading ? (
              <div className="w-4 h-4 border-2 border-white border-b-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Key size={15} />
                <span>{isSignUp ? "إنشاء حساب جديد وتثبيت كمسؤول" : "تسجيل الدخول للنظام"}</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle between Sign In & Sign Up */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setAuthError(null);
              setAuthSuccess(null);
            }}
            className="text-xs text-[#1877F2] hover:underline font-bold transition-colors cursor-pointer"
          >
            {isSignUp ? "هل لديك حساب بالفعل؟ تسجيل الدخول" : "ليس لديك حساب؟ إنشاء حساب جديد"}
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-4 text-center">
          <hr className="border-[#E4E6EB]" />
          <span className="absolute top-1/2 -translate-y-1/2 bg-white px-3 text-[10px] font-bold text-[#65676B]">أو المتابعة عبر</span>
        </div>

        {/* Alternative login methods */}
        <div className="space-y-2.5">
          <button 
            type="button"
            onClick={onGoogleLogin}
            disabled={authLoading}
            className="w-full py-2.5 px-4 bg-white hover:bg-[#F0F2F5] text-[#050505] font-bold rounded-xl transition-all flex items-center justify-center gap-2.5 text-xs border border-[#CCD0D5] cursor-pointer shadow-2xs"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
            <span>الدخول السريع بحساب Google Workspace</span>
          </button>

          <button 
            type="button"
            onClick={onBypassLogin}
            className="w-full py-2.5 px-4 bg-[#E7F3FF] hover:bg-[#DBEAFE] text-[#1877F2] font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs border border-[#BFDBFE] cursor-pointer"
          >
            <Zap size={15} />
            <span>الدخول التجريبي الفوري (مسؤول النظام) ⚡</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
