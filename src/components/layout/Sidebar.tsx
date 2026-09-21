import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Users, 
  LogOut,
  Wallet,
  Cloud,
  TrendingUp,
  ShieldAlert,
  Search,
  Receipt,
  ShieldCheck,
  X,
  ChevronLeft,
  FileCheck2,
  BookOpen,
  Target,
  Truck,
  CalendarCheck2
} from 'lucide-react';

export type TabId = 
  | 'dashboard' 
  | 'new-transaction' 
  | 'daily-journal'
  | 'reports' 
  | 'settlements' 
  | 'orders' 
  | 'journal-entries' 
  | 'budgets' 
  | 'employees' 
  | 'google-tools' 
  | 'profit-loss' 
  | 'cost-control' 
  | 'accruals' 
  | 'global-search' 
  | 'data-integrity';

interface SidebarProps {
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  user: any;
  onLogout: () => void;
  activeCustodyAlertsCount: number;
  balancesCount: number;
  gasConnected: boolean | null;
}

export default function Sidebar({
  activeTab,
  onNavigate,
  mobileMenuOpen,
  onCloseMobileMenu,
  user,
  onLogout,
  activeCustodyAlertsCount,
  balancesCount,
  gasConnected
}: SidebarProps) {
  return (
    <>
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 md:hidden"
          onClick={onCloseMobileMenu}
        />
      )}

      {/* Sidebar Container */}
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
              <p className="text-[11px] font-bold text-slate-500">نظام إدارة العهد والمصروفات</p>
            </div>
          </div>
          <button 
            onClick={onCloseMobileMenu}
            className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg"
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
              onClick={() => onNavigate('dashboard')} 
            />
            <SidebarItem 
              icon={<PlusCircle size={18} />} 
              label="تسجيل حركة مالية" 
              active={activeTab === 'new-transaction'} 
              badge="جديد +"
              badgeType="success"
              onClick={() => onNavigate('new-transaction')} 
            />
            <SidebarItem 
              icon={<CalendarCheck2 size={18} />} 
              label="اليومية المجمعة للصناديق" 
              active={activeTab === 'daily-journal'} 
              badge="يومي"
              badgeType="success"
              onClick={() => onNavigate('daily-journal')} 
            />
            <SidebarItem 
              icon={<FileText size={18} />} 
              label="كشف الحساب والعمليات" 
              active={activeTab === 'reports'} 
              onClick={() => onNavigate('reports')} 
            />
            <SidebarItem 
              icon={<FileCheck2 size={18} />} 
              label="محاضر جرد وتصفية العهد" 
              active={activeTab === 'settlements'} 
              badge="رسمي"
              badgeType="neutral"
              onClick={() => onNavigate('settlements')} 
            />
            <SidebarItem 
              icon={<Truck size={18} />} 
              label="متابعة الطلبيات والمواعيد" 
              active={activeTab === 'orders'} 
              badge="جديد"
              badgeType="success"
              onClick={() => onNavigate('orders')} 
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
              onClick={() => onNavigate('journal-entries')} 
            />
            <SidebarItem 
              icon={<Target size={18} />} 
              label="سقف الموازنات والانحرافات" 
              active={activeTab === 'budgets'} 
              onClick={() => onNavigate('budgets')} 
            />
            <SidebarItem 
              icon={<TrendingUp size={18} />} 
              label="الأرباح والخسائر بالفروع" 
              active={activeTab === 'profit-loss'} 
              onClick={() => onNavigate('profit-loss')} 
            />
            <SidebarItem 
              icon={<ShieldAlert size={18} />} 
              label="رادار ضبط التكاليف والهدر" 
              active={activeTab === 'cost-control'} 
              onClick={() => onNavigate('cost-control')} 
            />
            <SidebarItem 
              icon={<Receipt size={18} />} 
              label="المشتريات الآجلة والالتزامات" 
              active={activeTab === 'accruals'} 
              onClick={() => onNavigate('accruals')} 
            />
            <SidebarItem 
              icon={<Search size={18} />} 
              label="محرك البحث والتدقيق الشامل" 
              active={activeTab === 'global-search'} 
              onClick={() => onNavigate('global-search')} 
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
              badge={`${balancesCount}`}
              badgeType="neutral"
              onClick={() => onNavigate('employees')} 
            />
            <SidebarItem 
              icon={<ShieldCheck size={18} />} 
              label="أمان وحفظ البيانات والنسخ" 
              active={activeTab === 'data-integrity'} 
              onClick={() => onNavigate('data-integrity')} 
            />
            <SidebarItem 
              icon={<Cloud size={18} />} 
              label="أدوات Google Workspace" 
              active={activeTab === 'google-tools'} 
              badge={gasConnected ? "متصل" : "إعداد"}
              badgeType={gasConnected ? "success" : "neutral"}
              onClick={() => onNavigate('google-tools')} 
            />
          </div>
        </nav>

        {/* User profile & Logout */}
        <div className="p-5 border-t border-slate-900 bg-slate-950/60">
          <div className="flex items-center gap-3 mb-4 px-1">
            <img 
              src={user?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'} 
              className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 shrink-0" 
              alt="User" 
            />
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate">{user?.displayName || 'مسؤول النظام'}</p>
              <p className="text-[10px] text-slate-500 font-bold truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-slate-900 hover:border-red-500/20 transition-all font-black duration-200 cursor-pointer"
          >
            <LogOut size={14} />
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  badgeType?: 'default' | 'success' | 'warning' | 'neutral';
  onClick: () => void;
}

export function SidebarItem({ 
  icon, 
  label, 
  active = false, 
  badge, 
  badgeType = 'default', 
  onClick 
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl font-bold text-xs transition-all duration-200 cursor-pointer group ${
        active 
          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-black' 
          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`transition-colors shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}`}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      
      <div className="flex items-center gap-1.5 shrink-0">
        {badge && (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
            badgeType === 'warning'
              ? 'bg-amber-400 text-slate-950'
              : badgeType === 'success'
              ? 'bg-emerald-500/30 text-emerald-300'
              : badgeType === 'neutral'
              ? 'bg-slate-800 text-slate-300'
              : active 
              ? 'bg-white/20 text-white' 
              : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700'
          }`}>
            {badge}
          </span>
        )}
        {!active && (
          <ChevronLeft size={14} className="text-slate-700 group-hover:text-slate-500 group-hover:-translate-x-0.5 transition-all" />
        )}
      </div>
    </button>
  );
}
