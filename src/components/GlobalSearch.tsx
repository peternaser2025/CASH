import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Building, 
  User, 
  Tag, 
  ArrowDownRight, 
  ArrowUpRight, 
  Printer, 
  RefreshCw, 
  FileSpreadsheet, 
  X, 
  ExternalLink,
  ArrowRightLeft
} from 'lucide-react';
import { gasService } from '../services/gasService';
import { formatKWD, isTransferType, parseReportRow, isArabicSearchMatch, matchBranch } from '../utils/format';

interface SearchResultRow {
  index: number;
  date: string;
  time?: string;
  branch: string;
  type: string;
  category: string;
  income: number;
  expense: number;
  employee: string;
  description: string;
  rawRow: any;
}

interface GlobalSearchProps {
  branches: string[];
  categories: string[];
  employees: string[];
}

export default function GlobalSearch({ branches, categories, employees }: GlobalSearchProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [allRows, setAllRows] = useState<SearchResultRow[]>([]);

  // Selected Transaction for Detail Modal / Receipt
  const [selectedTx, setSelectedTx] = useState<SearchResultRow | null>(null);

  // Initial load or execute search
  const performSearch = async () => {
    setLoading(true);
    try {
      const reportData = await gasService.getReport({
        branch: 'All',
        startDate: startDate || '2020-01-01',
        endDate: endDate || '2030-12-31'
      });

      if (reportData && reportData.rows) {
        const parsed: SearchResultRow[] = reportData.rows.map((rawItem: any, idx: number) => {
          const norm = parseReportRow(rawItem);
          return {
            index: idx + 1,
            date: norm.date,
            time: rawItem.time || '',
            branch: norm.branch,
            type: norm.type,
            category: norm.category,
            income: norm.income,
            expense: norm.expense,
            employee: norm.employee,
            description: norm.description,
            rawRow: rawItem
          };
        });

        setAllRows(parsed);
      }
    } catch (err) {
      console.error('Error in global search:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performSearch();
  }, []);

  // Filter matching rows with high-performance memoization
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      const isTransfer = isTransferType(row.type, row.category, row.description);

      // 1. Branch
      if (selectedBranch !== 'All' && !matchBranch(row.branch, selectedBranch)) return false;

      // 2. Category
      if (selectedCategory !== 'All' && !isArabicSearchMatch(selectedCategory, row.category)) return false;

      // 3. Employee
      if (selectedEmployee !== 'All' && !isArabicSearchMatch(selectedEmployee, row.employee)) return false;

      // 4. Type (Inflow / Outflow / Transfer)
      if (selectedType === 'Expense' && (row.expense <= 0 || isTransfer)) return false;
      if (selectedType === 'Income' && (row.income <= 0 || isTransfer)) return false;
      if (selectedType === 'Transfer' && !isTransfer) return false;

      // 5. Amount Range
      const val = row.expense > 0 ? row.expense : row.income;
      if (minAmount && parseFloat(minAmount) > 0 && val < parseFloat(minAmount)) return false;
      if (maxAmount && parseFloat(maxAmount) > 0 && val > parseFloat(maxAmount)) return false;

      // 6. Smooth Arabic multi-token search
      if (searchTerm.trim() !== '') {
        const matches = isArabicSearchMatch(
          searchTerm,
          row.description,
          row.category,
          row.employee,
          row.branch,
          row.date,
          row.type,
          val,
          row.index
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [allRows, selectedBranch, selectedCategory, selectedEmployee, selectedType, minAmount, maxAmount, searchTerm]);

  // Auditor classification counts (for quick filters & visual legend)
  const counts = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;
    let transfers = 0;
    for (const r of allRows) {
      if (isTransferType(r.type, r.category, r.description)) {
        transfers++;
      } else if (r.income > 0) {
        incoming++;
      } else if (r.expense > 0) {
        outgoing++;
      }
    }
    return { incoming, outgoing, transfers, total: allRows.length };
  }, [allRows]);

  const filteredCounts = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;
    let transfers = 0;
    for (const r of filteredRows) {
      if (isTransferType(r.type, r.category, r.description)) {
        transfers++;
      } else if (r.income > 0) {
        incoming++;
      } else if (r.expense > 0) {
        outgoing++;
      }
    }
    return { incoming, outgoing, transfers, total: filteredRows.length };
  }, [filteredRows]);

  // Calculate search result KPIs with memoization
  const { totalInflow, totalOutflow, netCashflow } = useMemo(() => {
    const inflow = filteredRows.reduce((acc, r) => acc + (isTransferType(r.type, r.category, r.description) ? 0 : r.income), 0);
    const outflow = filteredRows.reduce((acc, r) => acc + (isTransferType(r.type, r.category, r.description) ? 0 : r.expense), 0);
    return {
      totalInflow: inflow,
      totalOutflow: outflow,
      netCashflow: inflow - outflow
    };
  }, [filteredRows]);

  // Export search results to CSV
  const handleExportCSV = () => {
    const headers = ['المسلسل', 'التاريخ', 'الوقت', 'الفرع', 'نوع العملية', 'التصنيف', 'الوارد (د.ك)', 'المنصرف (د.ك)', 'الموظف المسؤول', 'البيان'];
    const rows = filteredRows.map(r => [
      r.index,
      `"${r.date}"`,
      `"${r.time}"`,
      `"${r.branch}"`,
      `"${r.type}"`,
      `"${r.category}"`,
      r.income,
      r.expense,
      `"${r.employee}"`,
      `"${r.description.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `financial_search_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedBranch('All');
    setSelectedCategory('All');
    setSelectedEmployee('All');
    setSelectedType('All');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
  };

  return (
    <div className="space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-200 pb-8 no-print">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-[2px] bg-blue-600"></div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Universal Financial Audit & Search</span>
          </div>
          <h2 className="text-5xl font-black text-gray-900 tracking-tighter">
            محرك البحث والتدقيق <span className="text-blue-600 italic font-serif font-light">الشامل لكافة العمليات</span>
          </h2>
          <p className="text-gray-500 max-w-2xl font-medium text-base leading-relaxed">
            البحث اللحظي الذكي بدلالة أي نص، رقم فاتورة، قيمة مالية، أو نطاق زمني مع ربط البيانات التاريخية وتطبيق الفلاتر المتعددة بدقة مالية متكاملة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-black text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            تصدير نتائج البحث (Excel/CSV)
          </button>

          <button
            onClick={performSearch}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-full font-black text-xs transition-all hover:bg-gray-800 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            إعادة البحث
          </button>
        </div>
      </div>

      {/* Main Search Panel */}
      <div className="bg-white border-2 border-gray-900 rounded-[2.5rem] p-8 space-y-6 shadow-sm no-print">
        
        {/* Search input field */}
        <div className="relative">
          <Search size={22} className="absolute right-6 top-1/2 -translate-y-1/2 text-blue-600" />
          <input
            type="text"
            placeholder="ابحث بدلالة أي كلمة (رقم الفاتورة، اسم الشركة، اسم المورد، البيان، المبلغ، اسم الموظف)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pr-16 pl-6 py-5 bg-blue-50/40 border-2 border-gray-900 rounded-2xl font-bold text-base text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Multi-Criteria Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
          
          {/* Branch */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building size={14} className="text-blue-600" /> الفرع
            </label>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs text-gray-900 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">كافة الفروع</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tag size={14} className="text-blue-600" /> التصنيف
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs text-gray-900 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">كافة التصنيفات</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Employee */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <User size={14} className="text-blue-600" /> الموظف
            </label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs text-gray-900 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">كافة الموظفين</option>
              {employees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* Transaction Type */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Filter size={14} className="text-blue-600" /> نوع وطبيعة العملية
            </label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs text-gray-900 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">كافة العمليات (الكل: {counts.total})</option>
              <option value="Income">حركات الداخل (الوارد فقط 🟢: {counts.incoming})</option>
              <option value="Expense">حركات الخارج (المنصرف فقط 🔴: {counts.outgoing})</option>
              <option value="Transfer">حركات التحويل بين العهد 🔵: {counts.transfers}</option>
            </select>
          </div>

        </div>

        {/* Amount & Date Range Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">من تاريخ</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">إلى تاريخ</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl font-bold text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">الحد الأدنى للمبلغ (د.ك)</label>
            <input
              type="number"
              placeholder="0.000"
              value={minAmount}
              onChange={e => setMinAmount(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">الحد الأقصى للمبلغ (د.ك)</label>
            <input
              type="number"
              placeholder="0.000"
              value={maxAmount}
              onChange={e => setMaxAmount(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
            />
          </div>

        </div>

        {/* Clear Filters */}
        <div className="flex justify-end">
          <button
            onClick={resetFilters}
            className="text-xs font-black text-rose-600 hover:text-rose-700 underline cursor-pointer"
          >
            إعادة ضبط كافة الفلاتر والقيود
          </button>
        </div>

      </div>

      {/* Results KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">عدد نتائج البحث</span>
          <div className="text-3xl font-black font-mono text-gray-900 mt-1">
            {filteredRows.length} <span className="text-xs font-sans text-gray-400">عملية</span>
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 text-[10px] font-black text-gray-500">
            <span className="text-emerald-700">🟢 داخل: {filteredCounts.incoming}</span>
            <span>•</span>
            <span className="text-rose-700">🔴 خارج: {filteredCounts.outgoing}</span>
            {filteredCounts.transfers > 0 && (
              <>
                <span>•</span>
                <span className="text-blue-700">🔵 تحويل: {filteredCounts.transfers}</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-emerald-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              إجمالي حركات الداخل (الوارد)
            </span>
            <div className="p-1 bg-emerald-100 text-emerald-800 rounded-md">
              <ArrowDownRight size={14} className="stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-emerald-600 mt-2">
            +{formatKWD(totalInflow)} <span className="text-xs font-sans text-emerald-500">KWD</span>
          </div>
          <p className="text-[10px] font-bold text-gray-400 mt-1">إيرادات ومبيعات وتوريدات وتغذية أرصدة</p>
        </div>

        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-rose-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-rose-800 uppercase tracking-widest flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
              إجمالي حركات الخارج (المنصرف)
            </span>
            <div className="p-1 bg-rose-100 text-rose-800 rounded-md">
              <ArrowUpRight size={14} className="stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-rose-600 mt-2">
            -{formatKWD(totalOutflow)} <span className="text-xs font-sans text-rose-500">KWD</span>
          </div>
          <p className="text-[10px] font-bold text-gray-400 mt-1">مصاريف تشغيلية ومشتريات ونثريات</p>
        </div>

        <div className="bg-white border-2 border-gray-900 rounded-[2rem] p-6 shadow-sm relative overflow-hidden">
          <div className={`absolute top-0 right-0 left-0 h-1.5 ${netCashflow >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">صافي المحصلة المالية للبحث</span>
          <div className={`text-3xl font-black font-mono mt-2 ${netCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netCashflow >= 0 ? '+' : ''}{formatKWD(netCashflow)} <span className="text-xs font-sans text-gray-400">KWD</span>
          </div>
          <p className="text-[10px] font-bold text-gray-400 mt-1">
            {netCashflow >= 0 ? 'فائض نقدي لحركات البحث' : 'عجز / استهلاك نقدي'}
          </p>
        </div>

      </div>

      {/* Results Table */}
      <div className="bg-white border-2 border-gray-900 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
        
        {/* Table Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xl font-black text-gray-900">سجل نتائج البحث والتدقيق التفصيلي ({filteredRows.length})</h3>
            <p className="text-xs font-bold text-gray-400 mt-1">مرتبة بحسب السلسلة والترتيب الزمني مع التمييز اللوني البصري الفوري للحركات</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black flex items-center gap-2 no-print cursor-pointer transition-colors shadow-2xs"
            >
              <Printer size={14} />
              طباعة الكشف
            </button>
          </div>
        </div>

        {/* Auditor Visual Legend & Fast Filtering Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl no-print">
          {/* Visual Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <span className="text-slate-500 font-black text-[11px] uppercase tracking-wider ml-1">دليل التدقيق البصري:</span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-emerald-900 text-xs shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <ArrowDownRight size={13} className="text-emerald-700 stroke-[2.5]" />
              <span>أخضر: حركات الداخل (إيرادات، توريدات، تغذية)</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100/90 border border-rose-300 text-rose-900 text-xs shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <ArrowUpRight size={13} className="text-rose-700 stroke-[2.5]" />
              <span>أحمر: حركات الخارج (مصاريف، مشتريات، نثريات)</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-100/90 border border-blue-300 text-blue-900 text-xs shadow-2xs">
              <ArrowRightLeft size={13} className="text-blue-700" />
              <span>أزرق: تحويلات بين العهد والصناديق</span>
            </div>
          </div>

          {/* Quick Auditor Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black text-slate-400 ml-1">تصفية سريعة:</span>
            <button
              onClick={() => setSelectedType('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedType === 'All'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              الكل ({filteredCounts.total})
            </button>
            <button
              onClick={() => setSelectedType('Income')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedType === 'Income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
            >
              <ArrowDownRight size={13} className="stroke-[2.5]" />
              <span>الداخل فقط 🟢 ({filteredCounts.incoming})</span>
            </button>
            <button
              onClick={() => setSelectedType('Expense')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedType === 'Expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300'
              }`}
            >
              <ArrowUpRight size={13} className="stroke-[2.5]" />
              <span>الخارج فقط 🔴 ({filteredCounts.outgoing})</span>
            </button>
            <button
              onClick={() => setSelectedType('Transfer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedType === 'Transfer'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300'
              }`}
            >
              <ArrowRightLeft size={13} />
              <span>التحويلات 🔵 ({filteredCounts.transfers})</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw size={32} className="animate-spin text-blue-500 mx-auto" />
            <p className="font-black text-sm text-gray-500">جاري البحث المطابق في قواعد البيانات و Google Sheets...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Search size={40} className="text-gray-300 mx-auto" />
            <p className="font-black text-gray-600 text-base">لا توجد عمليات تطابق كلمات وفلاتر البحث التي أدخلتها</p>
            <button
              onClick={resetFilters}
              className="text-xs font-black text-blue-600 underline cursor-pointer"
            >
              إلغاء قيود البحث والبدء من جديد
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-gray-900">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider">
                  <th className="px-4 py-4 border-l border-white/10 text-center w-12">#</th>
                  <th className="px-4 py-4 border-l border-white/10 whitespace-nowrap">التاريخ والوقت</th>
                  <th className="px-4 py-4 border-l border-white/10 text-center whitespace-nowrap">طبيعة الحركة</th>
                  <th className="px-4 py-4 border-l border-white/10 whitespace-nowrap">الفرع</th>
                  <th className="px-4 py-4 border-l border-white/10 whitespace-nowrap">التصنيف</th>
                  <th className="px-4 py-4 border-l border-white/10 whitespace-nowrap">الموظف المسؤول</th>
                  <th className="px-5 py-4 border-l border-white/10 min-w-[200px]">البيان والتفاصيل</th>
                  <th className="px-5 py-4 border-l border-white/10 text-center whitespace-nowrap bg-emerald-950/70 text-emerald-300">
                    الوارد (داخل 🟢)
                  </th>
                  <th className="px-5 py-4 border-l border-white/10 text-center whitespace-nowrap bg-rose-950/70 text-rose-300">
                    المنصرف (خارج 🔴)
                  </th>
                  <th className="px-4 py-4 text-center no-print whitespace-nowrap">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-bold text-xs text-gray-800">
                {filteredRows.map((row) => {
                  const isTransfer = isTransferType(row.type, row.category, row.description);
                  const isInflow = row.income > 0;
                  const isOutflow = row.expense > 0;

                  let rowBg = "hover:bg-slate-50";
                  let borderAccent = "border-r-[6px] border-r-gray-300";
                  let flowBadge = null;

                  if (isTransfer) {
                    if (isInflow) {
                      rowBg = "bg-blue-50/30 hover:bg-blue-100/50";
                      borderAccent = "border-r-[6px] border-r-blue-500";
                      flowBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs whitespace-nowrap">
                          <ArrowRightLeft size={12} className="text-blue-700" />
                          <span>تحويل داخل 🟢</span>
                        </span>
                      );
                    } else {
                      rowBg = "bg-blue-50/20 hover:bg-blue-100/40";
                      borderAccent = "border-r-[6px] border-r-blue-400";
                      flowBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs whitespace-nowrap">
                          <ArrowRightLeft size={12} className="text-blue-700" />
                          <span>تحويل خارج 🔴</span>
                        </span>
                      );
                    }
                  } else if (isInflow) {
                    // Green classification for INFLOW / الداخل
                    rowBg = "bg-emerald-50/40 hover:bg-emerald-100/60";
                    borderAccent = "border-r-[6px] border-r-emerald-500";
                    flowBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs whitespace-nowrap">
                        <ArrowDownRight size={13} className="text-emerald-700 stroke-[2.5]" />
                        <span>داخل (وارد)</span>
                      </span>
                    );
                  } else if (isOutflow) {
                    // Red classification for OUTFLOW / الخارج
                    rowBg = "bg-rose-50/40 hover:bg-rose-100/60";
                    borderAccent = "border-r-[6px] border-r-rose-500";
                    flowBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs whitespace-nowrap">
                        <ArrowUpRight size={13} className="text-rose-700 stroke-[2.5]" />
                        <span>خارج (منصرف)</span>
                      </span>
                    );
                  } else {
                    rowBg = "hover:bg-gray-50";
                    borderAccent = "border-r-[6px] border-r-gray-300";
                    flowBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
                        قيد تسوية
                      </span>
                    );
                  }

                  return (
                    <tr key={row.index} className={`${rowBg} ${borderAccent} transition-colors`}>
                      <td className="px-4 py-3.5 border-l border-gray-200 font-mono text-center text-gray-400 font-black">
                        {row.index}
                      </td>

                      <td className="px-4 py-3.5 border-l border-gray-200 font-mono text-gray-700 whitespace-nowrap">
                        <div className="font-bold">{row.date}</div>
                        {row.time && <div className="text-[10px] text-gray-400 font-medium">{row.time}</div>}
                      </td>

                      <td className="px-4 py-3.5 border-l border-gray-200 text-center whitespace-nowrap">
                        {flowBadge}
                      </td>

                      <td className="px-4 py-3.5 border-l border-gray-200 font-black text-gray-900 whitespace-nowrap">
                        {row.branch}
                      </td>

                      <td className="px-4 py-3.5 border-l border-gray-200 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black inline-block ${
                          isTransfer ? 'bg-blue-100 text-blue-900 border border-blue-200' : 
                          isInflow ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' : 
                          'bg-rose-100 text-rose-900 border border-rose-200'
                        }`}>
                          {row.category}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 border-l border-gray-200 whitespace-nowrap font-black text-gray-800">
                        {row.employee || '-'}
                      </td>

                      <td className="px-5 py-3.5 border-l border-gray-200 max-w-md font-medium text-gray-800 leading-snug">
                        {row.description}
                      </td>

                      {/* Income (داخل 🟢) */}
                      <td className="px-5 py-3.5 border-l border-gray-200 text-center font-mono font-black whitespace-nowrap">
                        {row.income > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-emerald-100/90 text-emerald-800 border border-emerald-300 rounded-lg shadow-2xs font-mono font-black">
                            +{formatKWD(row.income)}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">-</span>
                        )}
                      </td>

                      {/* Expense (خارج 🔴) */}
                      <td className="px-5 py-3.5 border-l border-gray-200 text-center font-mono font-black whitespace-nowrap">
                        {row.expense > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-rose-100/90 text-rose-800 border border-rose-300 rounded-lg shadow-2xs font-mono font-black">
                            -{formatKWD(row.expense)}
                          </span>
                        ) : (
                          <span className="text-gray-300 font-normal">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center no-print whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTx(row)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-[11px] font-black cursor-pointer transition-all inline-flex items-center gap-1 shadow-2xs"
                          title="معاينة تفاصيل السند"
                        >
                          <ExternalLink size={12} /> معاينة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTx && (() => {
          const isModalInflow = selectedTx.income > 0;
          const isModalTransfer = isTransferType(selectedTx.type, selectedTx.category, selectedTx.description);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm no-print">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={`bg-white border-2 rounded-[2.5rem] max-w-lg w-full p-8 space-y-6 shadow-2xl relative overflow-hidden ${
                  isModalTransfer 
                    ? 'border-blue-900' 
                    : isModalInflow 
                      ? 'border-emerald-600' 
                      : 'border-rose-600'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl text-white shadow-sm ${
                      isModalTransfer 
                        ? 'bg-blue-600' 
                        : isModalInflow 
                          ? 'bg-emerald-600' 
                          : 'bg-rose-600'
                    }`}>
                      {isModalTransfer ? (
                        <ArrowRightLeft size={22} />
                      ) : isModalInflow ? (
                        <ArrowDownRight size={22} className="stroke-[2.5]" />
                      ) : (
                        <ArrowUpRight size={22} className="stroke-[2.5]" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900">سند العملية المالية #{selectedTx.index}</h3>
                      <p className="text-xs font-bold text-gray-400">تاريخ القيد: {selectedTx.date}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTx(null)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 font-black cursor-pointer transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Operation Direction Banner */}
                <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-black ${
                  isModalTransfer
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : isModalInflow
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <span className="flex items-center gap-1.5">
                    {isModalTransfer ? (
                      <>
                        <ArrowRightLeft size={14} className="text-blue-600" />
                        <span>تحويل نقدي بين العهد والصناديق</span>
                      </>
                    ) : isModalInflow ? (
                      <>
                        <ArrowDownRight size={15} className="text-emerald-600 stroke-[2.5]" />
                        <span>حركة واردة (داخل الصندوق 🟢)</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight size={15} className="text-rose-600 stroke-[2.5]" />
                        <span>حركة منصرفة (خارج الصندوق 🔴)</span>
                      </>
                    )}
                  </span>
                  <span className="font-mono text-sm">
                    {isModalInflow ? `+${formatKWD(selectedTx.income)}` : `-${formatKWD(selectedTx.expense)}`} KWD
                  </span>
                </div>

                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200 space-y-4 font-bold text-xs text-gray-800">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-gray-400">الفرع:</span>
                    <span className="font-black text-gray-900">{selectedTx.branch}</span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-gray-400">التصنيف الرئيسي:</span>
                    <span className="font-black text-blue-600">{selectedTx.category}</span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-gray-400">الموظف المسؤول:</span>
                    <span className="font-black text-gray-900">{selectedTx.employee || 'عام'}</span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-gray-400">المبلغ الإجمالي:</span>
                    <span className={`font-mono text-base font-black ${
                      isModalInflow ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {formatKWD(selectedTx.expense > 0 ? selectedTx.expense : selectedTx.income)} KWD
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-gray-400">البيان والتفاصيل:</span>
                    <p className="p-3 bg-white border border-gray-200 rounded-xl font-medium text-gray-900 leading-relaxed">
                      {selectedTx.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                  >
                    <Printer size={16} /> طباعة السند
                  </button>
                  <button
                    onClick={() => setSelectedTx(null)}
                    className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-black text-xs cursor-pointer transition-colors"
                  >
                    إغلاق
                  </button>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
