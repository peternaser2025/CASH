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
  CalendarCheck2,
  SlidersHorizontal
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
  | 'settings'
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
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 md:hidden"
          onClick={onCloseMobileMenu}
        />
      )}

      {/* Sidebar Container - Facebook & eBay Clean Modern Light Theme */}
      <aside className={`
        fixed md:static inset-y-0 right-0 z-50 w-72 lg:w-80 bg-white text-slate-800 flex flex-col shrink-0 border-l border-[#E4E6EB] shadow-xs no-print transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-5 lg:p-6 flex items-center justify-between border-b border-[#E4E6EB]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#1877F2] text-white rounded-2xl shadow-sm shadow-[#1877F2]/20">
              <Wallet size={22} className="text-white" />
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-[#050505]">KWD Finance</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-[#00875A]"></span>
                <p className="text-[10px] font-bold text-[#65676B]">منظومة الإدارة المالية الذكية</p>
              </div>
            </div>
          </div>
          <button 
            onClick={onCloseMobileMenu}
            className="md:hidden p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-[#F0F2F5] cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Structured Navigation List */}
        <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
          {/* Group 1: Operations */}
          <div className="space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between text-[11px] font-black text-[#65676B] uppercase tracking-wider">
              <span>العمليات والتقارير</span>
              <span className="text-[10px] text-[#8A8D91] font-mono">01</span>
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

          {/* Group 2: Financial Control */}
          <div className="space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between text-[11px] font-black text-[#65676B] uppercase tracking-wider">
              <span>الرقابة والتحليل المالي</span>
              <span className="text-[10px] text-[#8A8D91] font-mono">02</span>
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

          {/* Group 3: Administration */}
          <div className="space-y-1">
            <div className="px-3 pb-1 flex items-center justify-between text-[11px] font-black text-[#65676B] uppercase tracking-wider">
              <span>النظام والإدارة السحابية</span>
              <span className="text-[10px] text-[#8A8D91] font-mono">03</span>
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
              icon={<SlidersHorizontal size={18} />} 
              label="الإعدادات المركزية والجداول" 
              active={activeTab === 'settings'} 
              badge="مركزي"
              badgeType="success"
              onClick={() => onNavigate('settings')} 
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

        {/* User Profile & Logout - Facebook/eBay Card */}
        <div className="p-4 border-t border-[#E4E6EB] bg-[#F9FAFB]">
          <div className="flex items-center gap-3 mb-3 px-1">
            <img 
              src={user?.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'} 
              className="w-9 h-9 rounded-full bg-white border border-[#E4E6EB] shrink-0" 
              alt="User" 
            />
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-black text-[#050505] truncate">{user?.displayName || 'المدير العام'}</p>
              <p className="text-[10px] text-[#65676B] font-bold truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-[#65676B] hover:text-[#E41E3F] hover:bg-[#FEE2E2]/60 rounded-xl border border-[#E4E6EB] hover:border-[#FECACA] transition-all font-bold cursor-pointer"
          >
            <LogOut size={14} />
            <span>تسجيل الخروج</span>
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
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer group relative ${
        active 
          ? 'bg-[#E7F3FF] text-[#1877F2] font-black' 
          : 'text-[#050505] hover:bg-[#F0F2F5] hover:text-[#1877F2]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`transition-colors shrink-0 ${active ? 'text-[#1877F2]' : 'text-[#65676B] group-hover:text-[#1877F2]'}`}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      
      <div className="flex items-center gap-1.5 shrink-0">
        {badge && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
            badgeType === 'warning'
              ? 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]'
              : badgeType === 'success'
              ? 'bg-[#E3FCEF] text-[#00875A] border border-[#ABF5D1]'
              : badgeType === 'neutral'
              ? 'bg-[#F0F2F5] text-[#65676B] border border-[#E4E6EB]'
              : active 
              ? 'bg-[#1877F2] text-white' 
              : 'bg-[#F0F2F5] text-[#65676B]'
          }`}>
            {badge}
          </span>
        )}
        {!active && (
          <ChevronLeft size={14} className="text-[#8A8D91] group-hover:text-[#1877F2] group-hover:-translate-x-0.5 transition-all" />
        )}
      </div>

      {active && (
        <span className="absolute right-0 top-1.5 bottom-1.5 w-1 bg-[#1877F2] rounded-l-full"></span>
      )}
    </button>
  );
}
