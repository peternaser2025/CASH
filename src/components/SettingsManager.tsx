import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Tag, 
  Users, 
  Briefcase, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Search, 
  Filter, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  Code, 
  Copy, 
  ExternalLink, 
  FileSpreadsheet, 
  CheckCircle2, 
  Layers, 
  Phone, 
  BadgeCheck, 
  Power,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Database,
  Globe,
  Wifi,
  Save,
  Printer,
  DollarSign,
  Calendar,
  MapPin,
  Mail,
  Award,
  CheckCircle
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { 
  BranchSetting, 
  CategorySetting, 
  VendorSetting, 
  EmployeeSetting, 
  SystemSettings,
  CompanyProfile
} from '../types';
import { GOOGLE_APPS_SCRIPT_FULL_CODE } from '../utils/googleAppsScriptCode';
import { formatKWD } from '../utils/format';

interface SettingsManagerProps {
  onRefreshParentState?: () => void;
}

type ActiveSubTab = 'company' | 'branches' | 'categories' | 'vendors' | 'employees' | 'scripts';

const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  companyName: 'مصنع دار السلام 2',
  brandTagline: 'منظومة الإدارة المالية والتدقيق الرقابي KWD FINANCE PRO',
  currency: 'د.ك (دينار كويتي)',
  fiscalYear: '2026',
  crNumber: 'CR-104928-KWD',
  taxNumber: 'TX-49102-KWT',
  phone: '+965 2200 0000',
  email: 'finance@daralsalam2.com',
  address: 'دولة الكويت - المنطقة الصناعية - مجمع دار السلام 2',
  reportHeaderTitle: 'كشف مالي وتدقيق حسابات معتمد ورسمي',
  signatoryTitle: 'المدير المالي العام / قسم الحسابات والرقابة'
};

const PARENT_CATEGORIES = [
  'تشغيلي',
  'إداري',
  'ثابت',
  'إيرادات',
  'التزامات',
  'عمومية',
  'أخرى'
];

export default function SettingsManager({ onRefreshParentState }: SettingsManagerProps) {
  const [activeTab, setActiveTab] = useState<ActiveSubTab>('branches');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Core Data
  const [branches, setBranches] = useState<BranchSetting[]>([]);
  const [categories, setCategories] = useState<CategorySetting[]>([]);
  const [vendors, setVendors] = useState<VendorSetting[]>([]);
  const [employees, setEmployees] = useState<EmployeeSetting[]>([]);

  // Company Profile
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
      const saved = localStorage.getItem('kwd_company_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_COMPANY_PROFILE;
  });
  const [companySavedSuccess, setCompanySavedSuccess] = useState<boolean>(false);

  // GAS WebApp URL & Connection Testing
  const [gasUrlInput, setGasUrlInput] = useState<string>(gasService.getGasUrl());
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success?: boolean;
    latencyMs?: number;
    message?: string;
    error?: string;
  }>({ tested: false });
  const [testingConn, setTestingConn] = useState<boolean>(false);

  // Modals state
  const [editModalItem, setEditModalItem] = useState<{ type: ActiveSubTab; item?: any } | null>(null);
  const [integrityAlert, setIntegrityAlert] = useState<{
    isOpen: boolean;
    type: string;
    item: any;
    canDelete: boolean;
    linkedCount: number;
    sampleTransactions?: any[];
    reason?: string;
  } | null>(null);

  // Script execution feedback
  const [scriptFeedback, setScriptFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load Settings
  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await gasService.getSettings();
      if (data && data.settings) {
        setBranches(data.settings.branches || []);
        setCategories(data.settings.categories || []);
        setVendors(data.settings.vendors || []);
        setEmployees(data.settings.employees || []);
        if (data.settings.companyProfile) {
          setCompanyProfile(data.settings.companyProfile);
          try {
            localStorage.setItem('kwd_company_profile', JSON.stringify(data.settings.companyProfile));
          } catch (e) {}
        }
      } else {
        // Fallback or derive from simple arrays
        if (Array.isArray(data?.branches)) {
          setBranches(data.branches.map((b, i) => ({
            id: `BR-${String(i + 1).padStart(3, '0')}`,
            branchId: `BR-${String(i + 1).padStart(3, '0')}`,
            name: typeof b === 'string' ? b : (b as any).name,
            isActive: true
          })));
        }
        if (Array.isArray(data?.categories)) {
          setCategories(data.categories.map((c, i) => ({
            id: `CAT-${String(i + 1).padStart(3, '0')}`,
            categoryId: `CAT-${String(i + 1).padStart(3, '0')}`,
            name: typeof c === 'string' ? c : (c as any).name,
            parentCategory: 'عام',
            isActive: true
          })));
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // Test initial connection passively
    gasService.testConnection().then(res => {
      setConnectionStatus({
        tested: true,
        success: res.success,
        latencyMs: res.latencyMs,
        message: res.message,
        error: res.error
      });
    }).catch(() => {});
  }, []);

  // Save Settings
  const saveAllSettings = async (
    newBranches = branches,
    newCategories = categories,
    newVendors = vendors,
    newEmployees = employees
  ) => {
    setSaving(true);
    try {
      const payload: SystemSettings = {
        branches: newBranches,
        categories: newCategories,
        vendors: newVendors,
        employees: newEmployees,
        companyProfile,
        lastSync: new Date().toISOString()
      };
      await gasService.updateSettings(payload);
      setBranches(newBranches);
      setCategories(newCategories);
      setVendors(newVendors);
      setEmployees(newEmployees);
      if (onRefreshParentState) onRefreshParentState();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (urlToTest?: string) => {
    setTestingConn(true);
    try {
      const res = await gasService.testConnection(urlToTest || gasUrlInput);
      setConnectionStatus({
        tested: true,
        success: res.success,
        latencyMs: res.latencyMs,
        message: res.message,
        error: res.error
      });
    } catch (err: any) {
      setConnectionStatus({
        tested: true,
        success: false,
        error: err.message || 'فشل الاتصال برابط WebApp'
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleSaveCustomGasUrl = async () => {
    gasService.setGasUrl(gasUrlInput);
    await handleTestConnection(gasUrlInput);
  };

  const handleResetGasUrl = async () => {
    const defaultUrl = gasService.resetGasUrl();
    setGasUrlInput(defaultUrl);
    await handleTestConnection(defaultUrl);
  };

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      localStorage.setItem('kwd_company_profile', JSON.stringify(companyProfile));
      await gasService.updateSettings({
        branches,
        categories,
        vendors,
        employees,
        companyProfile,
        lastSync: new Date().toISOString()
      });
      setCompanySavedSuccess(true);
      setTimeout(() => setCompanySavedSuccess(false), 4000);
      if (onRefreshParentState) onRefreshParentState();
    } catch (err) {
      console.error('Failed to save company profile:', err);
    } finally {
      setSaving(false);
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (type: ActiveSubTab, id: string) => {
    if (type === 'branches') {
      const updated = branches.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b);
      await saveAllSettings(updated, categories, vendors, employees);
    } else if (type === 'categories') {
      const updated = categories.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
      await saveAllSettings(branches, updated, vendors, employees);
    } else if (type === 'vendors') {
      const updated = vendors.map(v => v.id === id ? { ...v, isActive: !v.isActive } : v);
      await saveAllSettings(branches, categories, updated, employees);
    } else if (type === 'employees') {
      const updated = employees.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e);
      await saveAllSettings(branches, categories, vendors, updated);
    }
  };

  // Pre-flight check before deleting an item
  const handleDeleteRequest = async (type: ActiveSubTab, item: any) => {
    const singleType = type.slice(0, -1) as any; // e.g. branch, category, vendor, employee
    const check = await gasService.checkReferentialIntegrity(singleType, item.name, item.id);
    
    setIntegrityAlert({
      isOpen: true,
      type,
      item,
      canDelete: check.canDelete,
      linkedCount: check.linkedCount,
      sampleTransactions: check.sampleTransactions,
      reason: check.reason
    });
  };

  // Confirm deletion
  const confirmDeleteAction = async (forceSoftDelete: boolean = false) => {
    if (!integrityAlert) return;
    const { type, item } = integrityAlert;
    const singleType = type.slice(0, -1);

    try {
      const res = await gasService.deleteSettingItem(singleType, item.id, forceSoftDelete);
      if (res.success) {
        if (res.softDeleted) {
          // Update in local state to inactive
          handleToggleActive(type as ActiveSubTab, item.id);
        } else {
          // Remove from local state
          if (type === 'branches') {
            const updated = branches.filter(b => b.id !== item.id);
            await saveAllSettings(updated, categories, vendors, employees);
          } else if (type === 'categories') {
            const updated = categories.filter(c => c.id !== item.id);
            await saveAllSettings(branches, updated, vendors, employees);
          } else if (type === 'vendors') {
            const updated = vendors.filter(v => v.id !== item.id);
            await saveAllSettings(branches, categories, updated, employees);
          } else if (type === 'employees') {
            const updated = employees.filter(e => e.id !== item.id);
            await saveAllSettings(branches, categories, vendors, updated);
          }
        }
      }
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setIntegrityAlert(null);
    }
  };

  // Handle Save from Add/Edit Modal
  const handleModalSave = async (formData: any) => {
    if (!editModalItem) return;
    const { type, item } = editModalItem;
    const isNew = !item;

    if (type === 'branches') {
      let updated: BranchSetting[];
      if (isNew) {
        const nextNum = branches.length + 1;
        const newBranch: BranchSetting = {
          id: `BR-${String(nextNum).padStart(3, '0')}`,
          branchId: `BR-${String(nextNum).padStart(3, '0')}`,
          name: formData.name.trim(),
          isActive: formData.isActive ?? true,
          notes: formData.notes,
          createdAt: new Date().toISOString()
        };
        updated = [...branches, newBranch];
      } else {
        updated = branches.map(b => b.id === item.id ? { ...b, ...formData } : b);
      }
      await saveAllSettings(updated, categories, vendors, employees);
    } else if (type === 'categories') {
      let updated: CategorySetting[];
      if (isNew) {
        const nextNum = categories.length + 1;
        const newCat: CategorySetting = {
          id: `CAT-${String(nextNum).padStart(3, '0')}`,
          categoryId: `CAT-${String(nextNum).padStart(3, '0')}`,
          name: formData.name.trim(),
          parentCategory: formData.parentCategory || 'تشغيلي',
          isActive: formData.isActive ?? true,
          notes: formData.notes,
          createdAt: new Date().toISOString()
        };
        updated = [...categories, newCat];
      } else {
        updated = categories.map(c => c.id === item.id ? { ...c, ...formData } : c);
      }
      await saveAllSettings(branches, updated, vendors, employees);
    } else if (type === 'vendors') {
      let updated: VendorSetting[];
      if (isNew) {
        const nextNum = vendors.length + 1;
        const newVendor: VendorSetting = {
          id: `VEN-${String(nextNum).padStart(3, '0')}`,
          vendorId: `VEN-${String(nextNum).padStart(3, '0')}`,
          name: formData.name.trim(),
          contactInfo: formData.contactInfo || '',
          isActive: formData.isActive ?? true,
          notes: formData.notes,
          createdAt: new Date().toISOString()
        };
        updated = [...vendors, newVendor];
      } else {
        updated = vendors.map(v => v.id === item.id ? { ...v, ...formData } : v);
      }
      await saveAllSettings(branches, categories, updated, employees);
    } else if (type === 'employees') {
      let updated: EmployeeSetting[];
      if (isNew) {
        const nextNum = employees.length + 1;
        const newEmp: EmployeeSetting = {
          id: `EMP-${String(nextNum).padStart(3, '0')}`,
          employeeId: `EMP-${String(nextNum).padStart(3, '0')}`,
          name: formData.name.trim(),
          role: formData.role || 'أمين عهدة / محاسب',
          isActive: formData.isActive ?? true,
          balance: 0,
          notes: formData.notes,
          createdAt: new Date().toISOString()
        };
        updated = [...employees, newEmp];
      } else {
        updated = employees.map(e => e.id === item.id ? { ...e, ...formData } : e);
      }
      await saveAllSettings(branches, categories, vendors, updated);
    }

    setEditModalItem(null);
  };

  // Run Google Apps Script Automation
  const handleRunSetupScript = async () => {
    setScriptFeedback(null);
    setLoading(true);
    try {
      const res = await gasService.runSetupSettingsSheet();
      if (res.success) {
        setScriptFeedback({
          type: 'success',
          message: res.message || 'تم فحص وإنشاء شيت Settings بنجاح تام دون أي مساس بالبيانات السابقة!'
        });
        await loadSettings();
      } else {
        setScriptFeedback({
          type: 'error',
          message: res.error || 'تعذر تشغيل السكريبت تلقائياً. يمكنك نسخ الكود أدناه وتثبيته في شيت جوجل.'
        });
      }
    } catch (e: any) {
      setScriptFeedback({
        type: 'error',
        message: e.message || 'خطأ أثناء الاتصال بسكريبت جوجل'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunSchemaScript = async () => {
    setScriptFeedback(null);
    setLoading(true);
    try {
      const res = await gasService.runSafeSchemaUpdate();
      if (res.success) {
        setScriptFeedback({
          type: 'success',
          message: res.message || 'تم تحديث الأعمدة المحاسبية جهة اليمين بنجاح تام!'
        });
      } else {
        setScriptFeedback({
          type: 'error',
          message: res.error || 'تعذر إضافة الأعمدة تلقائياً.'
        });
      }
    } catch (e: any) {
      setScriptFeedback({
        type: 'error',
        message: e.message || 'خطأ أثناء فحص الأعمدة'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunSetupAllEnterprise = async () => {
    setScriptFeedback(null);
    setLoading(true);
    try {
      const res = await gasService.setupAllEnterpriseSheets();
      if (res.success) {
        setScriptFeedback({
          type: 'success',
          message: res.message || 'تم فحص وتهيئة كافة شيتات المنظومة (البيانات، Settings، ProfitLoss_Reports، Orders، Budgets، SetupLog) بأمان تام!'
        });
        await loadSettings();
      } else {
        setScriptFeedback({
          type: 'error',
          message: res.error || 'تعذر استكمال التهيئة الشاملة تلقائياً.'
        });
      }
    } catch (e: any) {
      setScriptFeedback({
        type: 'error',
        message: e.message || 'خطأ أثناء الاتصال بسكريبت Google'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_FULL_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // Filtered lists
  const filteredBranches = useMemo(() => {
    return branches.filter(b => {
      const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.branchId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? b.isActive : !b.isActive;
      return matchesSearch && matchesStatus;
    });
  }, [branches, searchQuery, statusFilter]);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.categoryId.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.parentCategory && c.parentCategory.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? c.isActive : !c.isActive;
      return matchesSearch && matchesStatus;
    });
  }, [categories, searchQuery, statusFilter]);

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        v.vendorId.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (v.contactInfo && v.contactInfo.includes(searchQuery));
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? v.isActive : !v.isActive;
      return matchesSearch && matchesStatus;
    });
  }, [vendors, searchQuery, statusFilter]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        e.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (e.role && e.role.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? e.isActive : !e.isActive;
      return matchesSearch && matchesStatus;
    });
  }, [employees, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 pb-12 font-sans" dir="rtl">
      {/* Header Banner - Light Executive Theme */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-white to-sky-50/80 rounded-3xl p-6 lg:p-8 shadow-sm border border-emerald-200/80 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100/80 text-emerald-800 border border-emerald-300/80 rounded-full text-xs font-black tracking-wide mb-3">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>ميثاق الحفظ التام وعدم المساس بالبيانات التاريخية (0% حذف)</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <span>إدارة الإعدادات المركزية والجداول المرجعية</span>
              <span className="text-xs bg-emerald-100/70 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl font-bold">
                Google Sheets Multi-Sheet Sync
              </span>
            </h1>
            <p className="text-slate-600 text-sm mt-2 max-w-2xl font-medium leading-relaxed">
              تحكم مركزي كامل في هوية الشركة، الفروع، شجرة التصنيفات، الموردين المعتمدين، ومسؤولي العهد. مع تطبيق صارم لقواعد سلامة الربط المحاسبي ومنع تكرار أو حذف أي صفوف تاريخية في Google Sheets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live Status Pill */}
            <div className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold ${
              connectionStatus.tested && connectionStatus.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : connectionStatus.tested && !connectionStatus.success
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus.tested && connectionStatus.success
                  ? 'bg-emerald-500 animate-pulse'
                  : connectionStatus.tested && !connectionStatus.success
                  ? 'bg-rose-500'
                  : 'bg-amber-400'
              }`}></span>
              <span>
                {connectionStatus.tested && connectionStatus.success
                  ? `جوجل شيت متصل (${connectionStatus.latencyMs || 0}ms)`
                  : connectionStatus.tested && !connectionStatus.success
                  ? 'تعذر الاتصال بالسكريبت'
                  : 'جاري فحص الاتصال...'}
              </span>
            </div>

            <button
              onClick={() => loadSettings()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-2xl text-xs font-bold transition-all shadow-xs hover:shadow active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-emerald-600" : "text-slate-500"} />
              <span>تحديث البيانات</span>
            </button>
            <button
              onClick={() => setActiveTab('scripts')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
            >
              <Code size={15} />
              <span>أكواد وربط Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Safety Guarantee Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-200/80 text-xs">
          <div className="flex items-center gap-2.5 bg-white/80 p-2.5 rounded-2xl border border-slate-200/70 shadow-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></div>
            <span className="text-slate-700"><strong>شيت Settings:</strong> هيكل مستقل 4 جداول</span>
          </div>
          <div className="flex items-center gap-2.5 bg-white/80 p-2.5 rounded-2xl border border-slate-200/70 shadow-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></div>
            <span className="text-slate-700"><strong>الحفظ التاريخي:</strong> 0% حذف أو تفريغ</span>
          </div>
          <div className="flex items-center gap-2.5 bg-white/80 p-2.5 rounded-2xl border border-slate-200/70 shadow-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></div>
            <span className="text-slate-700"><strong>سلامة الربط:</strong> تدقيق قبل أي إجراء</span>
          </div>
          <div className="flex items-center gap-2.5 bg-white/80 p-2.5 rounded-2xl border border-slate-200/70 shadow-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></div>
            <span className="text-slate-700"><strong>توسيع الأعمدة:</strong> لليمين فقط بأمان</span>
          </div>
        </div>
      </div>

      {/* Navigation SubTabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'company'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Building2 size={16} />
          <span>الهوية والبيانات المالية</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'company' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600 font-bold'}`}>
            عام
          </span>
        </button>

        <button
          onClick={() => setActiveTab('branches')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'branches'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Building2 size={16} />
          <span>فروع الشركة والمواقع</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'branches' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-600 font-mono'}`}>
            {branches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Tag size={16} />
          <span>شجرة التصنيفات والبنود</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'categories' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600 font-mono'}`}>
            {categories.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'vendors'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Briefcase size={16} />
          <span>الموردون والشركات</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'vendors' ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-600 font-mono'}`}>
            {vendors.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'employees'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Users size={16} />
          <span>الموظفون والمسؤولون</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'employees' ? 'bg-amber-700 text-amber-100' : 'bg-slate-100 text-slate-600 font-mono'}`}>
            {employees.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('scripts')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'scripts'
              ? 'bg-slate-800 text-white shadow-md shadow-slate-800/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Code size={16} />
          <span>أكواد وربط Google Sheets</span>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
            نشط ومربوط
          </span>
        </button>
      </div>

      {/* Main Tab Contents */}
      {activeTab === 'company' ? (
        /* Company Profile & Official Identity Tab */
        <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/90 shadow-sm space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-black mb-2">
                <Building2 size={13} className="text-blue-600" />
                <span>البيانات المؤسسية والترويسة الرسمية</span>
              </div>
              <h2 className="text-xl font-black text-slate-900">الهوية التجارية والبيئة المالية المعتمدة</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                تظهر هذه البيانات تلقائياً في ترويسة كافة مستندات الصرف، كشوفات الحساب، وتقارير الأرباح والخسائر والطلبيات.
              </p>
            </div>

            {companySavedSuccess && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-2xl text-xs font-black shadow-xs">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>تم حفظ وتثبيت الهوية المالية بنجاح في المنظومة وشيت جوجل!</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveCompanyProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Core Identity */}
              <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-200/80 pb-2.5">
                  <Award size={16} className="text-emerald-600" />
                  <span>بيانات المنشأة والنشاط</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المنشأة / الشركة الرسمي *</label>
                  <input
                    type="text"
                    required
                    value={companyProfile.companyName}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, companyName: e.target.value })}
                    placeholder="مثال: مصنع دار السلام 2"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الشعار أو الوصف التجاري</label>
                  <input
                    type="text"
                    value={companyProfile.brandTagline || ''}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, brandTagline: e.target.value })}
                    placeholder="مثال: منظومة الإدارة المالية والتدقيق الرقابي KWD FINANCE PRO"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <DollarSign size={13} className="text-emerald-600" />
                      <span>العملة المعتمدة</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={companyProfile.currency}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, currency: e.target.value })}
                      placeholder="د.ك (دينار كويتي)"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Calendar size={13} className="text-blue-600" />
                      <span>السنة المالية</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={companyProfile.fiscalYear}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, fiscalYear: e.target.value })}
                      placeholder="2026"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم السجل التجاري</label>
                    <input
                      type="text"
                      value={companyProfile.crNumber || ''}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, crNumber: e.target.value })}
                      placeholder="CR-104928-KWD"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">الرقم الضريبي / الترخيص</label>
                    <input
                      type="text"
                      value={companyProfile.taxNumber || ''}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, taxNumber: e.target.value })}
                      placeholder="TX-49102-KWT"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Contact & Report Signatures */}
              <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-200/80 pb-2.5">
                  <MapPin size={16} className="text-blue-600" />
                  <span>الاتصال وعناوين الاعتماد الرسمي</span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Phone size={13} className="text-slate-500" />
                      <span>هاتف الإدارة المالية</span>
                    </label>
                    <input
                      type="text"
                      value={companyProfile.phone || ''}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, phone: e.target.value })}
                      placeholder="+965 2200 0000"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Mail size={13} className="text-slate-500" />
                      <span>البريد الإلكتروني المعتمد</span>
                    </label>
                    <input
                      type="email"
                      value={companyProfile.email || ''}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, email: e.target.value })}
                      placeholder="finance@daralsalam2.com"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">العنوان الجغرافي / المقر والمصنع</label>
                  <input
                    type="text"
                    value={companyProfile.address || ''}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, address: e.target.value })}
                    placeholder="دولة الكويت - المنطقة الصناعية - مجمع دار السلام 2"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Printer size={13} className="text-purple-600" />
                    <span>عنوان الترويسة العلوية للمطبوعات</span>
                  </label>
                  <input
                    type="text"
                    value={companyProfile.reportHeaderTitle || ''}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, reportHeaderTitle: e.target.value })}
                    placeholder="كشف مالي وتدقيق حسابات معتمد ورسمي"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">مسمى التوقيع وجهة الاعتماد</label>
                  <input
                    type="text"
                    value={companyProfile.signatoryTitle || ''}
                    onChange={(e) => setCompanyProfile({ ...companyProfile, signatoryTitle: e.target.value })}
                    placeholder="المدير المالي العام / قسم الحسابات والرقابة"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Official Letterhead Live Preview */}
            <div className="bg-slate-50/60 rounded-3xl p-6 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
                <span className="flex items-center gap-2">
                  <Printer size={15} className="text-slate-500" />
                  <span>معاينة حية لترويسة المستندات والتقارير المطبوعة الرسمية</span>
                </span>
                <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                  تحديث فوري
                </span>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-300/80 shadow-xs text-right relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
                  <div>
                    <h4 className="text-xl font-black text-slate-900">{companyProfile.companyName || 'اسم الشركة'}</h4>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">{companyProfile.brandTagline}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 mt-2 font-medium">
                      {companyProfile.crNumber && <span>س.ت: <strong>{companyProfile.crNumber}</strong></span>}
                      {companyProfile.taxNumber && <span>ر.ض: <strong>{companyProfile.taxNumber}</strong></span>}
                      {companyProfile.phone && <span>هاتف: <strong>{companyProfile.phone}</strong></span>}
                      {companyProfile.address && <span>المقر: <strong>{companyProfile.address}</strong></span>}
                    </div>
                  </div>

                  <div className="text-right sm:text-left border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                    <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 inline-block mb-1">
                      {companyProfile.currency || 'د.ك'}
                    </span>
                    <p className="text-[11px] font-bold text-slate-500">السنة المالية: {companyProfile.fiscalYear || '2026'}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">وثيقة رسمية معتمدة</p>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>العنوان المطبوع: <strong>{companyProfile.reportHeaderTitle || 'كشف رسمي'}</strong></span>
                  <span>المفوض بالاعتماد: <strong>{companyProfile.signatoryTitle || 'الإدارة المالية'}</strong></span>
                </div>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={16} />
                <span>{saving ? 'جاري الحفظ والتثبيت...' : 'حفظ وتثبيت البيانات المؤسسية'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : activeTab !== 'scripts' ? (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3 max-w-lg">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو المعرف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  نشط
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    statusFilter === 'inactive' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  معطل
                </button>
              </div>
            </div>

            <button
              onClick={() => setEditModalItem({ type: activeTab })}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>
                {activeTab === 'branches' && 'إضافة فرع جديد'}
                {activeTab === 'categories' && 'إضافة بند / تصنيف جديد'}
                {activeTab === 'vendors' && 'إضافة مورد معتمد'}
                {activeTab === 'employees' && 'إضافة موظف / مسؤول عهدة'}
              </span>
            </button>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            {activeTab === 'branches' && (
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="py-3 px-4">كود الفرع (BranchID)</th>
                    <th className="py-3 px-4">اسم الفرع / الموقع (BranchName)</th>
                    <th className="py-3 px-4">الحالة (IsActive)</th>
                    <th className="py-3 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredBranches.map(branch => (
                    <tr key={branch.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{branch.branchId}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Building2 size={15} className="text-emerald-600" />
                        <span>{branch.name}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive('branches', branch.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black cursor-pointer transition-all ${
                            branch.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${branch.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {branch.isActive ? 'نشط ومتاح' : 'معطل'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditModalItem({ type: 'branches', item: branch })}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteRequest('branches', branch)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف آمن مع فحص السلامة"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredBranches.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        لا توجد فروع مطابقة لمعايير البحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'categories' && (
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="py-3 px-4">كود البند (CategoryID)</th>
                    <th className="py-3 px-4">اسم البند / التصنيف (CategoryName)</th>
                    <th className="py-3 px-4">التصنيف الأب (ParentCategory)</th>
                    <th className="py-3 px-4">الحالة (IsActive)</th>
                    <th className="py-3 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredCategories.map(cat => (
                    <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{cat.categoryId}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Tag size={15} className="text-blue-600" />
                        <span>{cat.name}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px]">
                          {cat.parentCategory || 'عام'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive('categories', cat.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black cursor-pointer transition-all ${
                            cat.isActive
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${cat.isActive ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                          {cat.isActive ? 'نشط ومتاح' : 'معطل'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditModalItem({ type: 'categories', item: cat })}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteRequest('categories', cat)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف آمن"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCategories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        لا توجد تصنيفات مطابقة لمعايير البحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'vendors' && (
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="py-3 px-4">كود المورد (VendorID)</th>
                    <th className="py-3 px-4">اسم المورد / الشركة (VendorName)</th>
                    <th className="py-3 px-4">بيانات التواصل (ContactInfo)</th>
                    <th className="py-3 px-4">الحالة (IsActive)</th>
                    <th className="py-3 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredVendors.map(vendor => (
                    <tr key={vendor.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{vendor.vendorId}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Briefcase size={15} className="text-purple-600" />
                        <span>{vendor.name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {vendor.contactInfo ? (
                          <span className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Phone size={13} className="text-slate-400" />
                            {vendor.contactInfo}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive('vendors', vendor.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black cursor-pointer transition-all ${
                            vendor.isActive
                              ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${vendor.isActive ? 'bg-purple-500' : 'bg-slate-400'}`}></span>
                          {vendor.isActive ? 'نشط ومتاح' : 'معطل'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditModalItem({ type: 'vendors', item: vendor })}
                            className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteRequest('vendors', vendor)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف آمن"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredVendors.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        لا يوجد موردون مطابقون لمعايير البحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'employees' && (
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="py-3 px-4">كود الموظف (EmployeeID)</th>
                    <th className="py-3 px-4">اسم الموظف / العهدة (EmployeeName)</th>
                    <th className="py-3 px-4">الدور / الوظيفة (Role)</th>
                    <th className="py-3 px-4">الرصيد المحسوب</th>
                    <th className="py-3 px-4">الحالة (IsActive)</th>
                    <th className="py-3 px-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{emp.employeeId}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <Users size={15} className="text-amber-600" />
                        <span>{emp.name}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold text-[11px]">
                          {emp.role || 'مسؤول عهدة'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {emp.balance !== undefined ? `${formatKWD(emp.balance)} د.ك` : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleActive('employees', emp.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black cursor-pointer transition-all ${
                            emp.isActive
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${emp.isActive ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                          {emp.isActive ? 'نشط ومتاح' : 'معطل'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditModalItem({ type: 'employees', item: emp })}
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteRequest('employees', emp)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف آمن"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        لا يوجد موظفون مطابقون لمعايير البحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Google Apps Script & Safe Migration Tab */
        <div className="space-y-6">
          {/* Live WebApp Connection Controller Card */}
          <div className="bg-white rounded-3xl p-6 lg:p-7 border border-emerald-200/90 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-black mb-1.5">
                  <Wifi size={13} className="text-emerald-600" />
                  <span>محرك الربط المباشر مع Google Sheets WebApp</span>
                </div>
                <h3 className="text-lg font-black text-slate-900">إدارة رابط النشر والاتصال الحي</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  يمكنك تعديل رابط الـ WebApp الخاص بسكريبت جوجل في أي وقت أو فحص سرعة الاستجابة اللحظية دون فقدان أي بيانات.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTestConnection()}
                  disabled={testingConn}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={testingConn ? "animate-spin" : ""} />
                  <span>{testingConn ? 'جاري الفحص...' : 'فحص الاتصال الحي الآن'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetGasUrl}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="استعادة الرابط الافتراضي"
                >
                  استعادة الافتراضي
                </button>
              </div>
            </div>

            {/* URL input field */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Globe size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-left"
                  dir="ltr"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveCustomGasUrl}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
              >
                تحديث وحفظ الرابط
              </button>
            </div>

            {/* Connection feedback box */}
            {connectionStatus.tested && (
              <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
                connectionStatus.success
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-rose-50 text-rose-900 border-rose-300'
              }`}>
                <div className="flex items-center gap-2.5">
                  {connectionStatus.success ? (
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                  )}
                  <span>{connectionStatus.success ? connectionStatus.message : connectionStatus.error}</span>
                </div>
                {connectionStatus.latencyMs !== undefined && (
                  <span className="font-mono text-[11px] bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                    زمن الاستجابة: {connectionStatus.latencyMs}ms
                  </span>
                )}
              </div>
            )}

            {/* Toolbar Menu Notice */}
            <div className="bg-gradient-to-r from-sky-50 via-slate-50 to-emerald-50 rounded-2xl p-4 border border-sky-200 text-xs text-slate-700 space-y-2">
              <div className="flex items-center gap-2 font-black text-sky-900">
                <Sparkles size={16} className="text-sky-600" />
                <span>قائمة شريط الأدوات التفاعلية المدمجة في Google Sheets (onOpen Menu)</span>
              </div>
              <p className="font-medium text-slate-600 leading-relaxed">
                تم تضمين دالة <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-900 font-bold">onOpen(e)</code> داخل السكريبت أدناه. بمجرد فتحك لملف Google Sheets ستجد قائمة مخصصة جديدة باسم <strong className="text-slate-900">"🏢 منظومة KWD FINANCE PRO"</strong> في أعلى الشاشة تمكّنك بنقرة واحدة من:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-bold text-slate-800 text-[11px]">
                <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>التهيئة الشاملة للشيتات الستة</span>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>التحديث الآمن للأعمدة لليمين</span>
                </div>
                <div className="bg-white/80 p-2 rounded-xl border border-slate-200/60 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span>الانتقال الفوري بين الشيتات المعتمدة</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action triggers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-3xl p-6 border border-emerald-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                    <FileSpreadsheet size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">1. تهيئة شيت الإعدادات setupSettingsSheet()</h3>
                    <p className="text-xs text-slate-500 font-medium">إنشاء وفحص جداول Settings الأربعة دون حذف أي سجل سابق</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  يقوم بفحص ملف جوجل شيت الخاص بك؛ إذا كان شيت <strong>Settings</strong> غير موجود، ينشئه بجداوله الأربعة (الفروع، التصنيفات، الموردين، الموظفين). إذا كان موجوداً، يحافظ على بياناتك المسجلة 100% ويسجل العملية في شيت SetupLog.
                </p>
              </div>
              <button
                onClick={handleRunSetupScript}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={16} />
                <span>تشغيل الفحص والتهيئة في Google Sheets</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-blue-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-blue-100 text-blue-800 rounded-2xl">
                    <Database size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">2. التحديث الآمن للأعمدة safeSchemaUpdate()</h3>
                    <p className="text-xs text-slate-500 font-medium">إضافة الأعمدة المحاسبية الناقصة جهة اليمين فقط</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  يفحص شيت المعاملات ويتأكد من وجود الأعمدة: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">targetMonth</code>، <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">vendorName</code>، <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">linkedAccrualId</code>، <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">isSettlement</code>. يضيف الناقص منها جهة اليمين دون إزاحة أي عمود.
                </p>
              </div>
              <button
                onClick={handleRunSchemaScript}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Layers size={16} />
                <span>تشغيل التحديث الآمن للأعمدة</span>
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-indigo-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-indigo-100 text-indigo-800 rounded-2xl">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">3. الترقية والتهيئة الشاملة setupAllEnterpriseSheets()</h3>
                    <p className="text-xs text-slate-500 font-medium">تهيئة شيتات الأرباح، الطلبيات، والموازنات والرقابة</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  ينشئ ويفحص تلقائياً شيتات المنظومة: <strong>ProfitLoss_Reports</strong> (الأرباح والخسائر)، <strong>Orders</strong> (الطلبيات والتوريد)، <strong>Budgets</strong> (الموازنات التقديرية)، و <strong>SetupLog</strong> (سجل التدقيق الرقابي) دون حذف أي صفوف نهائياً.
                </p>
              </div>
              <button
                onClick={handleRunSetupAllEnterprise}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={16} />
                <span>تشغيل الترقية الشاملة لكافة الشيتات الآن</span>
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {scriptFeedback && (
            <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${
              scriptFeedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}>
              {scriptFeedback.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              )}
              <span>{scriptFeedback.message}</span>
            </div>
          )}

          {/* Full Code Display */}
          <div className="bg-slate-950 text-slate-100 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Code size={18} className="text-emerald-400" />
                  <span>الكود البرمجي الكامل لسكريبت Google Apps Script (.gs)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  يتضمن دوال setupSettingsSheet و safeSchemaUpdate و onEdit(e) لحماية البيانات
                </p>
              </div>

              <button
                onClick={copyScriptToClipboard}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  copiedCode 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedCode ? 'تم النسخ بنجاح!' : 'نسخ الكود بالكامل'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-900/90 rounded-2xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-96 leading-relaxed border border-slate-800/80">
              {GOOGLE_APPS_SCRIPT_FULL_CODE}
            </pre>
          </div>
        </div>
      )}

      {/* Edit / Add Modal */}
      <AnimatePresence>
        {editModalItem && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  {editModalItem.item ? <Edit3 size={16} className="text-emerald-600" /> : <Plus size={16} className="text-emerald-600" />}
                  <span>
                    {editModalItem.item ? 'تعديل بيانات البند' : 'إضافة بند جديد'} (
                    {editModalItem.type === 'branches' && 'فرع'}
                    {editModalItem.type === 'categories' && 'تصنيف'}
                    {editModalItem.type === 'vendors' && 'مورد'}
                    {editModalItem.type === 'employees' && 'موظف'}
                    )
                  </span>
                </h3>
                <button
                  onClick={() => setEditModalItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.target as any;
                  const formData: any = {
                    name: target.name.value,
                    isActive: target.isActive.checked
                  };
                  if (target.parentCategory) formData.parentCategory = target.parentCategory.value;
                  if (target.contactInfo) formData.contactInfo = target.contactInfo.value;
                  if (target.role) formData.role = target.role.value;
                  handleModalSave(formData);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الاسم / البيان *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editModalItem.item?.name || ''}
                    placeholder="أدخل الاسم بوضوح..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {editModalItem.type === 'categories' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      التصنيف الرئيسي (Parent Category)
                    </label>
                    <select
                      name="parentCategory"
                      defaultValue={editModalItem.item?.parentCategory || 'تشغيلي'}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    >
                      {PARENT_CATEGORIES.map(pc => (
                        <option key={pc} value={pc}>{pc}</option>
                      ))}
                    </select>
                  </div>
                )}

                {editModalItem.type === 'vendors' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      رقم الهاتف أو بيانات الاتصال
                    </label>
                    <input
                      type="text"
                      name="contactInfo"
                      defaultValue={editModalItem.item?.contactInfo || ''}
                      placeholder="هاتف المورد، البريد..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                )}

                {editModalItem.type === 'employees' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      المسمى الوظيفي / الدور
                    </label>
                    <input
                      type="text"
                      name="role"
                      defaultValue={editModalItem.item?.role || 'أمين عهدة / محاسب'}
                      placeholder="مثال: كاشير، أمين عهدة، مدير..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    defaultChecked={editModalItem.item?.isActive ?? true}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                  />
                  <label htmlFor="isActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                    متاح ونشط في القوائم المنسدلة للتطبيق
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditModalItem(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'جارٍ الحفظ...' : 'حفظ البيانات'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Referential Integrity Safety Modal */}
      <AnimatePresence>
        {integrityAlert && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded-2xl shrink-0 ${integrityAlert.canDelete ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                  {integrityAlert.canDelete ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {integrityAlert.canDelete ? 'تأكيد الحذف الآمن للبند' : 'حماية الربط المحاسبي (Referential Integrity)'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    البند: <strong className="text-slate-800">{integrityAlert.item.name}</strong>
                  </p>
                </div>
              </div>

              <div className={`p-4 rounded-2xl text-xs leading-relaxed font-medium border ${
                integrityAlert.canDelete 
                  ? 'bg-amber-50 text-amber-900 border-amber-200' 
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}>
                {integrityAlert.reason}
              </div>

              {/* Sample transactions preview if linked */}
              {!integrityAlert.canDelete && integrityAlert.sampleTransactions && integrityAlert.sampleTransactions.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-black text-slate-700">نماذج من الحركات المالية المرتبطة بهذا البند:</p>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {integrityAlert.sampleTransactions.map(tx => (
                      <div key={tx.id} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] flex items-center justify-between">
                        <span className="font-mono text-slate-500">{tx.date}</span>
                        <span className="text-slate-700 font-bold truncate max-w-[200px]">{tx.description || tx.type}</span>
                        <span className="font-bold text-slate-900 font-mono">{formatKWD(tx.amount)} د.ك</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIntegrityAlert(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء التراجع
                </button>

                {!integrityAlert.canDelete ? (
                  <button
                    type="button"
                    onClick={() => confirmDeleteAction(true)}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Power size={14} />
                    <span>تعطيل البند (إلغاء تنشيطه لحفظ السجلات)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => confirmDeleteAction(false)}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>حذف نهائي (غير مرتبط بأي حركات)</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
