import { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Filter, Printer, Download, Search, Loader2 } from 'lucide-react';
import { gasService } from '../services/gasService';
import { ReportFilter, ReportData } from '../types';
import { BRANCHES } from '../constants';

interface ReportViewerProps {
  employees: string[];
}

export default function ReportViewer({ employees }: ReportViewerProps) {
  const [filters, setFilters] = useState<ReportFilter>({
    employee: '',
    branch: '',
    type: 'All',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const data = await gasService.getReport(filters);
    setReport(data);
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">كشف حساب مفصل</h2>
          <p className="text-gray-500 mt-1">توليد تقارير احترافية بناءً على فلاتر مخصصة</p>
        </div>
        {report && (
          <div className="flex gap-3">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
            >
              <Printer size={16} />
              طباعة التقرير
            </button>
          </div>
        )}
      </div>

      {/* Filters Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm no-print">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">الموظف</label>
            <select
              value={filters.employee}
              onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            >
              <option value="">اختر الموظف (الكل)</option>
              {employees.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">الفرع</label>
            <select
              value={filters.branch}
              onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            >
              <option value="">الكل</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">النوع</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            >
              <option value="All">الكل</option>
              <option value="Expense">مصروفات</option>
              <option value="Income">توريدات</option>
              <option value="Transfer">تحويلات</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">من تاريخ</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">إلى تاريخ</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            />
          </div>
          <div className="md:col-span-5 flex justify-end mt-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:bg-gray-300"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              توليد الكشف
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {report && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:shadow-none print:border-none"
          id="printable-report"
        >
          {/* Print Header */}
          <div className="hidden print:flex justify-between items-center mb-8 border-b-2 border-gray-900 pb-6">
            <div className="text-right">
              <h1 className="text-3xl font-black text-gray-900">كشف حساب مالي</h1>
              <p className="text-sm font-bold text-gray-500">KWD Finance Pro - نظام إدارة العهد</p>
            </div>
            <div className="text-left">
              <div className="w-16 h-16 bg-gray-900 rounded-lg flex items-center justify-center text-white font-black text-2xl mb-2">K</div>
              <p className="text-[10px] text-gray-400">تاريخ التقرير: {new Date().toLocaleDateString('ar-KW')}</p>
            </div>
          </div>

          <div className="p-8 border-b border-gray-100 flex justify-between items-start print:border-none print:p-0 print:mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">كشف حساب تفصيلي</h1>
              <p className="text-gray-500 mt-1">الموظف: {filters.employee || 'الكل'}</p>
              <p className="text-gray-500">الفترة: من {filters.startDate} إلى {filters.endDate}</p>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">KWD Finance Pro</p>
              <p className="text-xs text-gray-400 mt-1">تاريخ الاستخراج: {new Date().toLocaleString('ar-KW')}</p>
            </div>
          </div>

          <div className="p-8 bg-gray-50/50 flex justify-between items-center border-b border-gray-100 print:bg-white print:border-y print:border-gray-200 print:my-4">
            <div className="text-center">
              <p className="text-xs font-bold text-gray-400 uppercase print:text-gray-600">الرصيد الافتتاحي</p>
              <p className="text-xl font-bold text-gray-900">{report.openingBalance} د.ك</p>
            </div>
            <div className="h-8 w-px bg-gray-200 print:bg-gray-300"></div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-400 uppercase print:text-gray-600">إجمالي المدين</p>
              <p className="text-xl font-bold text-red-600">
                {report.rows.reduce((acc, row) => acc + (row[6] || 0), 0).toFixed(3)} د.ك
              </p>
            </div>
            <div className="h-8 w-px bg-gray-200 print:bg-gray-300"></div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-400 uppercase print:text-gray-600">إجمالي الدائن</p>
              <p className="text-xl font-bold text-emerald-600">
                {report.rows.reduce((acc, row) => acc + (row[5] || 0), 0).toFixed(3)} د.ك
              </p>
            </div>
            <div className="h-8 w-px bg-gray-200 print:bg-gray-300"></div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-400 uppercase print:text-gray-600">الرصيد الختامي</p>
              <p className="text-xl font-bold text-blue-600">{report.finalBalance} د.ك</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-100 print:bg-gray-100 print:text-gray-900">
                  <th className="px-6 py-4 font-bold">التاريخ</th>
                  <th className="px-6 py-4 font-bold">الفرع</th>
                  <th className="px-6 py-4 font-bold">النوع</th>
                  <th className="px-6 py-4 font-bold">التصنيف</th>
                  <th className="px-6 py-4 font-bold text-emerald-600 print:text-emerald-800">وارد (+)</th>
                  <th className="px-6 py-4 font-bold text-red-600 print:text-red-800">صادر (-)</th>
                  <th className="px-6 py-4 font-bold bg-gray-100/50 print:bg-gray-200">الرصيد الجاري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(!report.rows || report.rows.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Search size={40} className="opacity-20" />
                        <p>لا توجد بيانات لهذه الفترة أو لهذا الموظف</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors print:break-inside-avoid">
                      <td className="px-6 py-4 font-mono">{row[0]}</td>
                      <td className="px-6 py-4">{row[2] || 'عام'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row[3].includes('Income') || row[3].includes('In') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {row[3]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{row[4]}</td>
                      <td className="px-6 py-4 font-bold text-emerald-600">{row[5] > 0 ? row[5].toFixed(3) : '-'}</td>
                      <td className="px-6 py-4 font-bold text-red-600">{row[6] > 0 ? row[6].toFixed(3) : '-'}</td>
                      <td className="px-6 py-4 font-bold bg-gray-50/30 font-mono">{row[7]} د.ك</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer for Print */}
          <div className="p-12 hidden print:block border-t border-gray-100 mt-8">
            <div className="grid grid-cols-3 gap-12 text-center">
              <div className="space-y-4">
                <div className="h-px bg-gray-300 w-full"></div>
                <p className="text-sm font-bold">توقيع المحاسب</p>
              </div>
              <div className="space-y-4">
                <div className="h-px bg-gray-300 w-full"></div>
                <p className="text-sm font-bold">توقيع الموظف</p>
              </div>
              <div className="space-y-4">
                <div className="h-px bg-gray-300 w-full"></div>
                <p className="text-sm font-bold">ختم الشركة</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
